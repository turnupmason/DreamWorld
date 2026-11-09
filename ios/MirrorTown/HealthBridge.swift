import Foundation
import HealthKit

/// Reads Apple Health on the phone and turns it into small JSON messages for the game.
/// Apple Watch, Oura, Whoop and other devices write into Apple Health, so reading Health covers them all.
/// Raw health data never leaves the phone; the game only turns it into coins, wood, seeds and moods.
final class HealthBridge {
    private let store = HKHealthStore()
    /// Called with {active, type, start, hr} while a workout is live (mirrored from our future Watch app).
    var onWorkout: ((String) -> Void)?
    private var mirror: AnyObject?

    private var readTypes: Set<HKObjectType> {
        var s = Set<HKObjectType>()
        let quantities: [HKQuantityTypeIdentifier] = [
            .stepCount, .pushCount, .activeEnergyBurned, .appleExerciseTime,
            .heartRate, .restingHeartRate, .heartRateVariabilitySDNN, .respiratoryRate,
        ]
        quantities.forEach { if let t = HKObjectType.quantityType(forIdentifier: $0) { s.insert(t) } }
        let categories: [HKCategoryTypeIdentifier] = [.sleepAnalysis, .mindfulSession, .appleStandHour]
        categories.forEach { if let t = HKObjectType.categoryType(forIdentifier: $0) { s.insert(t) } }
        s.insert(HKObjectType.workoutType())
        s.insert(HKObjectType.activitySummaryType())
        return s
    }

    func requestAccess(_ done: @escaping (Bool) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { done(false); return }
        store.requestAuthorization(toShare: nil, read: readTypes) { ok, _ in done(ok) }
    }

    // MARK: - today's numbers

    /// Today so far: steps, wheelchair pushes, Move kcal, Exercise minutes, Stand hours, mindful minutes,
    /// workouts, vitals, and last night's sleep. Calls back on the main queue with a JSON string.
    func today(_ done: @escaping (String) -> Void) {
        guard HKHealthStore.isHealthDataAvailable() else { done("{\"available\":false}"); return }
        let cal = Calendar.current
        let now = Date()
        let start = cal.startOfDay(for: now)
        let group = DispatchGroup()
        let lock = NSLock()
        var out: [String: Any] = ["available": true]
        let set: (String, Any) -> Void = { key, value in lock.lock(); out[key] = value; lock.unlock() }
        let perMinute = HKUnit.count().unitDivided(by: .minute())

        let sum: (HKQuantityTypeIdentifier, HKUnit, String) -> Void = { id, unit, key in
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: start, end: now, options: .strictStartDate)
            let q = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: pred, options: .cumulativeSum) { _, stats, _ in
                if let v = stats?.sumQuantity()?.doubleValue(for: unit) { set(key, v) }
                group.leave()
            }
            self.store.execute(q)
        }
        let latest: (HKQuantityTypeIdentifier, HKUnit, String) -> Void = { id, unit, key in
            guard let type = HKQuantityType.quantityType(forIdentifier: id) else { return }
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: now.addingTimeInterval(-3 * 86400), end: now, options: [])
            let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
            let q = HKSampleQuery(sampleType: type, predicate: pred, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
                if let s = samples?.first as? HKQuantitySample { set(key, (s.quantity.doubleValue(for: unit) * 10).rounded() / 10) }
                group.leave()
            }
            self.store.execute(q)
        }

        sum(.stepCount, .count(), "steps")
        sum(.pushCount, .count(), "pushes")
        sum(.activeEnergyBurned, .kilocalorie(), "kcal")
        sum(.appleExerciseTime, .minute(), "exMin")
        latest(.restingHeartRate, perMinute, "rhr")
        latest(.heartRateVariabilitySDNN, .secondUnit(with: .milli), "hrv")
        latest(.respiratoryRate, perMinute, "resp")

        // Stand hours come from today's Activity summary.
        group.enter()
        var comps = cal.dateComponents([.era, .year, .month, .day], from: now)
        comps.calendar = cal
        let summary = HKActivitySummaryQuery(predicate: HKQuery.predicateForActivitySummary(with: comps)) { _, summaries, _ in
            if let s = summaries?.first { set("standH", s.appleStandHours.doubleValue(for: .count())) }
            group.leave()
        }
        store.execute(summary)

        // Mindful minutes today.
        if let mindful = HKObjectType.categoryType(forIdentifier: .mindfulSession) {
            group.enter()
            let pred = HKQuery.predicateForSamples(withStart: start, end: now, options: [])
            store.execute(HKSampleQuery(sampleType: mindful, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
                let minutes = (samples ?? []).reduce(0.0) { $0 + $1.endDate.timeIntervalSince($1.startDate) / 60 }
                set("mindful", minutes)
                group.leave()
            })
        }

        group.enter()
        lastNight { sleep in
            if let sleep = sleep { set("sleep", sleep) }
            group.leave()
        }

        group.enter()
        workouts(since: start) { list in
            set("workouts", list)
            group.leave()
        }

        group.notify(queue: .main) {
            lock.lock(); let snapshot = out; lock.unlock()
            let data = (try? JSONSerialization.data(withJSONObject: snapshot)) ?? Data("{}".utf8)
            done(String(data: data, encoding: .utf8) ?? "{}")
        }
    }

    // MARK: - sleep

    /// Last night (6 pm yesterday to 2 pm today), in minutes per stage. When several sources recorded the
    /// night (say Apple Watch and an Oura ring), we use the one that recorded the most sleep.
    /// The game computes the sleep score from these minutes.
    private func lastNight(_ done: @escaping ([String: Any]?) -> Void) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else { done(nil); return }
        let today = Calendar.current.startOfDay(for: Date())
        let pred = HKQuery.predicateForSamples(withStart: today.addingTimeInterval(-6 * 3600), end: today.addingTimeInterval(14 * 3600), options: [])
        let total: ([String: Double]) -> Double = { ($0["deep"] ?? 0) + ($0["rem"] ?? 0) + ($0["core"] ?? 0) }
        store.execute(HKSampleQuery(sampleType: type, predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            var bySource: [String: [String: Double]] = [:]
            for case let s as HKCategorySample in samples ?? [] {
                if (s.metadata?[HKMetadataKeyWasUserEntered] as? Bool) == true { continue }
                let minutes = s.endDate.timeIntervalSince(s.startDate) / 60
                let source = s.sourceRevision.source.name
                guard let stage = HKCategoryValueSleepAnalysis(rawValue: s.value) else { continue }
                var d = bySource[source] ?? [:]
                switch stage {
                case .asleepDeep: d["deep", default: 0] += minutes
                case .asleepREM: d["rem", default: 0] += minutes
                case .asleepCore, .asleepUnspecified: d["core", default: 0] += minutes
                case .awake: d["awake", default: 0] += minutes
                default: break   // in bed
                }
                bySource[source] = d
            }
            guard let best = bySource.max(by: { total($0.value) < total($1.value) }), total(best.value) > 60 else { done(nil); return }
            let d = best.value
            done(["asleep": total(d), "deep": d["deep"] ?? 0, "rem": d["rem"] ?? 0, "core": d["core"] ?? 0, "awake": d["awake"] ?? 0, "source": best.key])
        })
    }

    // MARK: - workouts

    private func workouts(since start: Date, _ done: @escaping ([[String: Any]]) -> Void) {
        let pred = HKQuery.predicateForSamples(withStart: start, end: Date(), options: [])
        store.execute(HKSampleQuery(sampleType: HKObjectType.workoutType(), predicate: pred, limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, _ in
            let list: [[String: Any]] = (samples as? [HKWorkout] ?? []).map { w in
                let kcal = w.totalEnergyBurned?.doubleValue(for: .kilocalorie()) ?? 0
                // "sport" is Apple's own workout type number, so every kind of workout can have its own trophy (v0.10)
                return ["id": w.uuid.uuidString, "type": HealthBridge.kind(w.workoutActivityType), "sport": Int(w.workoutActivityType.rawValue),
                        "min": w.duration / 60, "kcal": kcal, "start": w.startDate.timeIntervalSince1970 * 1000]
            }
            done(list)
        })
    }

    /// Workout types the game knows (each has its own animation for the townie).
    static func kind(_ t: HKWorkoutActivityType) -> String {
        switch t {
        case .walking, .hiking: return "walk"
        case .running: return "run"
        case .cycling, .handCycling: return "cycle"
        case .swimming, .waterFitness: return "swim"
        case .traditionalStrengthTraining, .functionalStrengthTraining, .coreTraining: return "strength"
        case .yoga, .pilates, .mindAndBody, .flexibility: return "yoga"
        case .highIntensityIntervalTraining, .crossTraining, .mixedCardio, .jumpRope, .boxing, .kickboxing: return "hiit"
        case .socialDance, .cardioDance: return "dance"
        case .wheelchairWalkPace, .wheelchairRunPace: return "wheel"
        default: return "walk"
        }
    }

    /// A finished workout shows up in Health right away, so we refresh then.
    /// Live "mini me" while you're still working out needs our own Apple Watch app that mirrors its
    /// session to the phone (iOS 17+). We already listen for that here; the Watch app is the next step.
    func watchWorkouts(onChange: @escaping () -> Void) {
        let q = HKObserverQuery(sampleType: HKObjectType.workoutType(), predicate: nil) { _, completion, _ in
            onChange()
            completion()
        }
        store.execute(q)
        if #available(iOS 17.0, *) {
            store.workoutSessionMirroringStartHandler = { [weak self] session in
                guard let self = self else { return }
                self.mirror = MirroredWorkout(session: session) { [weak self] json in self?.onWorkout?(json) }
            }
        }
    }
}

/// A workout started on the Apple Watch app and mirrored to this phone: tells the game it's live,
/// with the type and heart rate, and when it ends.
/// v0.57: HKLiveWorkoutBuilder only exists on the Watch, so the phone can't read the heart rate itself. The Watch app
/// sends it over the mirrored session (`sendToRemoteWorkoutSession`) as small JSON like {"hr": 128}.
@available(iOS 17.0, *)
final class MirroredWorkout: NSObject, HKWorkoutSessionDelegate {
    private let session: HKWorkoutSession
    private let send: (String) -> Void
    private var heartRate = 0

    init(session: HKWorkoutSession, send: @escaping (String) -> Void) {
        self.session = session
        self.send = send
        super.init()
        session.delegate = self
        report(active: true)
    }

    private func report(active: Bool) {
        let type = HealthBridge.kind(session.workoutConfiguration.activityType)
        let start = Int((session.startDate ?? Date()).timeIntervalSince1970 * 1000)
        send("{\"active\":\(active),\"type\":\"\(type)\",\"start\":\(start),\"hr\":\(heartRate)}")
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didChangeTo toState: HKWorkoutSessionState, from fromState: HKWorkoutSessionState, date: Date) {
        if toState == .ended || toState == .stopped { report(active: false) }
    }

    func workoutSession(_ workoutSession: HKWorkoutSession, didFailWithError error: Error) {
        report(active: false)
    }

    /// Messages from the Watch app over the mirrored session: {"hr": beats per minute}.
    func workoutSession(_ workoutSession: HKWorkoutSession, didReceiveDataFromRemoteWorkoutSession data: [Data]) {
        for d in data {
            guard let obj = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
                  let hr = (obj["hr"] as? NSNumber)?.intValue else { continue }
            heartRate = hr
        }
        report(active: true)
    }
}
