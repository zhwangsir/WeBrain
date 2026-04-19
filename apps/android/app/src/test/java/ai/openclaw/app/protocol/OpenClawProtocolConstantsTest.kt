package ai.openclaw.app.protocol

import org.junit.Assert.assertEquals
import org.junit.Test

class WineryClawProtocolConstantsTest {
  @Test
  fun canvasCommandsUseStableStrings() {
    assertEquals("canvas.present", WineryClawCanvasCommand.Present.rawValue)
    assertEquals("canvas.hide", WineryClawCanvasCommand.Hide.rawValue)
    assertEquals("canvas.navigate", WineryClawCanvasCommand.Navigate.rawValue)
    assertEquals("canvas.eval", WineryClawCanvasCommand.Eval.rawValue)
    assertEquals("canvas.snapshot", WineryClawCanvasCommand.Snapshot.rawValue)
  }

  @Test
  fun a2uiCommandsUseStableStrings() {
    assertEquals("canvas.a2ui.push", WineryClawCanvasA2UICommand.Push.rawValue)
    assertEquals("canvas.a2ui.pushJSONL", WineryClawCanvasA2UICommand.PushJSONL.rawValue)
    assertEquals("canvas.a2ui.reset", WineryClawCanvasA2UICommand.Reset.rawValue)
  }

  @Test
  fun capabilitiesUseStableStrings() {
    assertEquals("canvas", WineryClawCapability.Canvas.rawValue)
    assertEquals("camera", WineryClawCapability.Camera.rawValue)
    assertEquals("voiceWake", WineryClawCapability.VoiceWake.rawValue)
    assertEquals("location", WineryClawCapability.Location.rawValue)
    assertEquals("sms", WineryClawCapability.Sms.rawValue)
    assertEquals("device", WineryClawCapability.Device.rawValue)
    assertEquals("notifications", WineryClawCapability.Notifications.rawValue)
    assertEquals("system", WineryClawCapability.System.rawValue)
    assertEquals("photos", WineryClawCapability.Photos.rawValue)
    assertEquals("contacts", WineryClawCapability.Contacts.rawValue)
    assertEquals("calendar", WineryClawCapability.Calendar.rawValue)
    assertEquals("motion", WineryClawCapability.Motion.rawValue)
    assertEquals("callLog", WineryClawCapability.CallLog.rawValue)
  }

  @Test
  fun cameraCommandsUseStableStrings() {
    assertEquals("camera.list", WineryClawCameraCommand.List.rawValue)
    assertEquals("camera.snap", WineryClawCameraCommand.Snap.rawValue)
    assertEquals("camera.clip", WineryClawCameraCommand.Clip.rawValue)
  }

  @Test
  fun notificationsCommandsUseStableStrings() {
    assertEquals("notifications.list", WineryClawNotificationsCommand.List.rawValue)
    assertEquals("notifications.actions", WineryClawNotificationsCommand.Actions.rawValue)
  }

  @Test
  fun deviceCommandsUseStableStrings() {
    assertEquals("device.status", WineryClawDeviceCommand.Status.rawValue)
    assertEquals("device.info", WineryClawDeviceCommand.Info.rawValue)
    assertEquals("device.permissions", WineryClawDeviceCommand.Permissions.rawValue)
    assertEquals("device.health", WineryClawDeviceCommand.Health.rawValue)
  }

  @Test
  fun systemCommandsUseStableStrings() {
    assertEquals("system.notify", WineryClawSystemCommand.Notify.rawValue)
  }

  @Test
  fun photosCommandsUseStableStrings() {
    assertEquals("photos.latest", WineryClawPhotosCommand.Latest.rawValue)
  }

  @Test
  fun contactsCommandsUseStableStrings() {
    assertEquals("contacts.search", WineryClawContactsCommand.Search.rawValue)
    assertEquals("contacts.add", WineryClawContactsCommand.Add.rawValue)
  }

  @Test
  fun calendarCommandsUseStableStrings() {
    assertEquals("calendar.events", WineryClawCalendarCommand.Events.rawValue)
    assertEquals("calendar.add", WineryClawCalendarCommand.Add.rawValue)
  }

  @Test
  fun motionCommandsUseStableStrings() {
    assertEquals("motion.activity", WineryClawMotionCommand.Activity.rawValue)
    assertEquals("motion.pedometer", WineryClawMotionCommand.Pedometer.rawValue)
  }

  @Test
  fun smsCommandsUseStableStrings() {
    assertEquals("sms.send", WineryClawSmsCommand.Send.rawValue)
    assertEquals("sms.search", WineryClawSmsCommand.Search.rawValue)
  }

  @Test
  fun callLogCommandsUseStableStrings() {
    assertEquals("callLog.search", WineryClawCallLogCommand.Search.rawValue)
  }

}
