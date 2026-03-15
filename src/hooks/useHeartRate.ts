import { useState, useCallback } from 'react';

export function useHeartRate() {
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(async () => {
    try {
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }],
      });

      const server = await device.gatt?.connect();
      const service = await server?.getPrimaryService('heart_rate');
      const characteristic = await service?.getCharacteristic('heart_rate_measurement');

      await characteristic?.startNotifications();
      characteristic?.addEventListener('characteristicvaluechanged', (event: any) => {
        const value = event.target.value;
        const hr = value.getUint8(1);
        setHeartRate(hr);
      });

      setIsConnected(true);
      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setHeartRate(null);
      });
    } catch (error: any) {
      console.error('Heart rate connection error:', error);
      if (error.name === 'SecurityError' || error.message.includes('permissions policy')) {
        alert("Bluetooth is blocked by the browser's security policy for iframes. \n\nPlease click the 'Open in new tab' button in the top right of the editor to use the Heart Rate monitor.");
      } else {
        alert("Could not connect to heart rate monitor. Ensure Bluetooth is on and the device is in pairing mode.");
      }
    }
  }, []);

  return { heartRate, isConnected, connect };
}
