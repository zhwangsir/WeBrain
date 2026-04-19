export type MatrixManagedDeviceInfo = {
  deviceId: string;
  displayName: string | null;
  current: boolean;
};

export type MatrixDeviceHealthSummary = {
  currentDeviceId: string | null;
  staleWineryClawDevices: MatrixManagedDeviceInfo[];
  currentWineryClawDevices: MatrixManagedDeviceInfo[];
};

const WINERYCLAW_DEVICE_NAME_PREFIX = "WineryClaw ";

export function isWineryClawManagedMatrixDevice(displayName: string | null | undefined): boolean {
  return displayName?.startsWith(WINERYCLAW_DEVICE_NAME_PREFIX) === true;
}

export function summarizeMatrixDeviceHealth(
  devices: MatrixManagedDeviceInfo[],
): MatrixDeviceHealthSummary {
  const currentDeviceId = devices.find((device) => device.current)?.deviceId ?? null;
  const openClawDevices = devices.filter((device) =>
    isWineryClawManagedMatrixDevice(device.displayName),
  );
  return {
    currentDeviceId,
    staleWineryClawDevices: openClawDevices.filter((device) => !device.current),
    currentWineryClawDevices: openClawDevices.filter((device) => device.current),
  };
}
