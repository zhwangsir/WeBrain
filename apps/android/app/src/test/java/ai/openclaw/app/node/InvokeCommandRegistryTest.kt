package ai.openclaw.app.node

import ai.openclaw.app.protocol.WineryClawCalendarCommand
import ai.openclaw.app.protocol.WineryClawCameraCommand
import ai.openclaw.app.protocol.WineryClawCallLogCommand
import ai.openclaw.app.protocol.WineryClawCapability
import ai.openclaw.app.protocol.WineryClawContactsCommand
import ai.openclaw.app.protocol.WineryClawDeviceCommand
import ai.openclaw.app.protocol.WineryClawLocationCommand
import ai.openclaw.app.protocol.WineryClawMotionCommand
import ai.openclaw.app.protocol.WineryClawNotificationsCommand
import ai.openclaw.app.protocol.WineryClawPhotosCommand
import ai.openclaw.app.protocol.WineryClawSmsCommand
import ai.openclaw.app.protocol.WineryClawSystemCommand
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InvokeCommandRegistryTest {
  private val coreCapabilities =
    setOf(
      WineryClawCapability.Canvas.rawValue,
      WineryClawCapability.Device.rawValue,
      WineryClawCapability.Notifications.rawValue,
      WineryClawCapability.System.rawValue,
      WineryClawCapability.Photos.rawValue,
      WineryClawCapability.Contacts.rawValue,
      WineryClawCapability.Calendar.rawValue,
    )

  private val optionalCapabilities =
    setOf(
      WineryClawCapability.Camera.rawValue,
      WineryClawCapability.Location.rawValue,
      WineryClawCapability.Sms.rawValue,
      WineryClawCapability.CallLog.rawValue,
      WineryClawCapability.VoiceWake.rawValue,
      WineryClawCapability.Motion.rawValue,
    )

  private val coreCommands =
    setOf(
      WineryClawDeviceCommand.Status.rawValue,
      WineryClawDeviceCommand.Info.rawValue,
      WineryClawDeviceCommand.Permissions.rawValue,
      WineryClawDeviceCommand.Health.rawValue,
      WineryClawNotificationsCommand.List.rawValue,
      WineryClawNotificationsCommand.Actions.rawValue,
      WineryClawSystemCommand.Notify.rawValue,
      WineryClawPhotosCommand.Latest.rawValue,
      WineryClawContactsCommand.Search.rawValue,
      WineryClawContactsCommand.Add.rawValue,
      WineryClawCalendarCommand.Events.rawValue,
      WineryClawCalendarCommand.Add.rawValue,
    )

  private val optionalCommands =
    setOf(
      WineryClawCameraCommand.Snap.rawValue,
      WineryClawCameraCommand.Clip.rawValue,
      WineryClawCameraCommand.List.rawValue,
      WineryClawLocationCommand.Get.rawValue,
      WineryClawMotionCommand.Activity.rawValue,
      WineryClawMotionCommand.Pedometer.rawValue,
      WineryClawSmsCommand.Send.rawValue,
      WineryClawSmsCommand.Search.rawValue,
      WineryClawCallLogCommand.Search.rawValue,
    )

  private val debugCommands = setOf("debug.logs", "debug.ed25519")

  @Test
  fun advertisedCapabilities_respectsFeatureAvailability() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags())

    assertContainsAll(capabilities, coreCapabilities)
    assertMissingAll(capabilities, optionalCapabilities)
  }

  @Test
  fun advertisedCapabilities_includesFeatureCapabilitiesWhenEnabled() {
    val capabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          voiceWakeEnabled = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
        ),
      )

    assertContainsAll(capabilities, coreCapabilities + optionalCapabilities)
  }

  @Test
  fun advertisedCommands_respectsFeatureAvailability() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags())

    assertContainsAll(commands, coreCommands)
    assertMissingAll(commands, optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_includesFeatureCommandsWhenEnabled() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(
          cameraEnabled = true,
          locationEnabled = true,
          sendSmsAvailable = true,
          readSmsAvailable = true,
          smsSearchPossible = true,
          callLogAvailable = true,
          motionActivityAvailable = true,
          motionPedometerAvailable = true,
          debugBuild = true,
        ),
      )

    assertContainsAll(commands, coreCommands + optionalCommands + debugCommands)
  }

  @Test
  fun advertisedCommands_onlyIncludesSupportedMotionCommands() {
    val commands =
      InvokeCommandRegistry.advertisedCommands(
        NodeRuntimeFlags(
          cameraEnabled = false,
          locationEnabled = false,
          sendSmsAvailable = false,
          readSmsAvailable = false,
          smsSearchPossible = false,
          callLogAvailable = false,
          voiceWakeEnabled = false,
          motionActivityAvailable = true,
          motionPedometerAvailable = false,
          debugBuild = false,
        ),
      )

    assertTrue(commands.contains(WineryClawMotionCommand.Activity.rawValue))
    assertFalse(commands.contains(WineryClawMotionCommand.Pedometer.rawValue))
  }

  @Test
  fun advertisedCommands_splitsSmsSendAndSearchAvailability() {
    val readOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(readSmsAvailable = true, smsSearchPossible = true),
      )
    val sendOnlyCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCommands =
      InvokeCommandRegistry.advertisedCommands(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCommands.contains(WineryClawSmsCommand.Search.rawValue))
    assertFalse(readOnlyCommands.contains(WineryClawSmsCommand.Send.rawValue))
    assertTrue(sendOnlyCommands.contains(WineryClawSmsCommand.Send.rawValue))
    assertFalse(sendOnlyCommands.contains(WineryClawSmsCommand.Search.rawValue))
    assertTrue(requestableSearchCommands.contains(WineryClawSmsCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_includeSmsWhenEitherSmsPathIsAvailable() {
    val readOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(readSmsAvailable = true),
      )
    val sendOnlyCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(sendSmsAvailable = true),
      )
    val requestableSearchCapabilities =
      InvokeCommandRegistry.advertisedCapabilities(
        defaultFlags(smsSearchPossible = true),
      )

    assertTrue(readOnlyCapabilities.contains(WineryClawCapability.Sms.rawValue))
    assertTrue(sendOnlyCapabilities.contains(WineryClawCapability.Sms.rawValue))
    assertFalse(requestableSearchCapabilities.contains(WineryClawCapability.Sms.rawValue))
  }

  @Test
  fun advertisedCommands_excludesCallLogWhenUnavailable() {
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(callLogAvailable = false))

    assertFalse(commands.contains(WineryClawCallLogCommand.Search.rawValue))
  }

  @Test
  fun advertisedCapabilities_excludesCallLogWhenUnavailable() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(callLogAvailable = false))

    assertFalse(capabilities.contains(WineryClawCapability.CallLog.rawValue))
  }

  @Test
  fun advertisedCapabilities_includesVoiceWakeWithoutAdvertisingCommands() {
    val capabilities = InvokeCommandRegistry.advertisedCapabilities(defaultFlags(voiceWakeEnabled = true))
    val commands = InvokeCommandRegistry.advertisedCommands(defaultFlags(voiceWakeEnabled = true))

    assertTrue(capabilities.contains(WineryClawCapability.VoiceWake.rawValue))
    assertFalse(commands.any { it.contains("voice", ignoreCase = true) })
  }

  @Test
  fun find_returnsForegroundMetadataForCameraCommands() {
    val list = InvokeCommandRegistry.find(WineryClawCameraCommand.List.rawValue)
    val location = InvokeCommandRegistry.find(WineryClawLocationCommand.Get.rawValue)

    assertNotNull(list)
    assertEquals(true, list?.requiresForeground)
    assertNotNull(location)
    assertEquals(false, location?.requiresForeground)
  }

  @Test
  fun find_returnsNullForUnknownCommand() {
    assertNull(InvokeCommandRegistry.find("not.real"))
  }

  private fun defaultFlags(
    cameraEnabled: Boolean = false,
    locationEnabled: Boolean = false,
    sendSmsAvailable: Boolean = false,
    readSmsAvailable: Boolean = false,
    smsSearchPossible: Boolean = false,
    callLogAvailable: Boolean = false,
    voiceWakeEnabled: Boolean = false,
    motionActivityAvailable: Boolean = false,
    motionPedometerAvailable: Boolean = false,
    debugBuild: Boolean = false,
  ): NodeRuntimeFlags =
    NodeRuntimeFlags(
      cameraEnabled = cameraEnabled,
      locationEnabled = locationEnabled,
      sendSmsAvailable = sendSmsAvailable,
      readSmsAvailable = readSmsAvailable,
      smsSearchPossible = smsSearchPossible,
      callLogAvailable = callLogAvailable,
      voiceWakeEnabled = voiceWakeEnabled,
      motionActivityAvailable = motionActivityAvailable,
      motionPedometerAvailable = motionPedometerAvailable,
      debugBuild = debugBuild,
    )

  private fun assertContainsAll(actual: List<String>, expected: Set<String>) {
    expected.forEach { value -> assertTrue(actual.contains(value)) }
  }

  private fun assertMissingAll(actual: List<String>, forbidden: Set<String>) {
    forbidden.forEach { value -> assertFalse(actual.contains(value)) }
  }
}
