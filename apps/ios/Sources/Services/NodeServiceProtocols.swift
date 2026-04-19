import CoreLocation
import Foundation
import WineryClawKit
import UIKit

typealias WineryClawCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias WineryClawCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: WineryClawCameraSnapParams) async throws -> WineryClawCameraSnapResult
    func clip(params: WineryClawCameraClipParams) async throws -> WineryClawCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: WineryClawLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: WineryClawLocationGetParams,
        desiredAccuracy: WineryClawLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: WineryClawLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

@MainActor
protocol DeviceStatusServicing: Sendable {
    func status() async throws -> WineryClawDeviceStatusPayload
    func info() -> WineryClawDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: WineryClawPhotosLatestParams) async throws -> WineryClawPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: WineryClawContactsSearchParams) async throws -> WineryClawContactsSearchPayload
    func add(params: WineryClawContactsAddParams) async throws -> WineryClawContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: WineryClawCalendarEventsParams) async throws -> WineryClawCalendarEventsPayload
    func add(params: WineryClawCalendarAddParams) async throws -> WineryClawCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: WineryClawRemindersListParams) async throws -> WineryClawRemindersListPayload
    func add(params: WineryClawRemindersAddParams) async throws -> WineryClawRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: WineryClawMotionActivityParams) async throws -> WineryClawMotionActivityPayload
    func pedometer(params: WineryClawPedometerParams) async throws -> WineryClawPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalResolveEvent: Sendable, Equatable {
    var replyId: String
    var approvalId: String
    var decision: WineryClawWatchExecApprovalDecision
    var sentAtMs: Int?
    var transport: String
}

struct WatchExecApprovalSnapshotRequestEvent: Sendable, Equatable {
    var requestId: String
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setStatusHandler(_ handler: (@Sendable (WatchMessagingStatus) -> Void)?)
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func setExecApprovalResolveHandler(_ handler: (@Sendable (WatchExecApprovalResolveEvent) -> Void)?)
    func setExecApprovalSnapshotRequestHandler(
        _ handler: (@Sendable (WatchExecApprovalSnapshotRequestEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: WineryClawWatchNotifyParams) async throws -> WatchNotificationSendResult
    func sendExecApprovalPrompt(
        _ message: WineryClawWatchExecApprovalPromptMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalResolved(
        _ message: WineryClawWatchExecApprovalResolvedMessage) async throws -> WatchNotificationSendResult
    func sendExecApprovalExpired(
        _ message: WineryClawWatchExecApprovalExpiredMessage) async throws -> WatchNotificationSendResult
    func syncExecApprovalSnapshot(
        _ message: WineryClawWatchExecApprovalSnapshotMessage) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
