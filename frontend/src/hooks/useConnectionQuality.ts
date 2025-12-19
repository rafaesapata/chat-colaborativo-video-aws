import { useState, useEffect, useCallback } from 'react';

export type ConnectionQuality = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';

interface ConnectionStats {
  quality: ConnectionQuality;
  rtt: number; // Round-trip time in ms
  packetLoss: number; // Percentage
  bitrate: number; // kbps
}

export function useConnectionQuality(peerConnections: Map<string, RTCPeerConnection>) {
  const [stats, setStats] = useState<Map<string, ConnectionStats>>(new Map());
  const [overallQuality, setOverallQuality] = useState<ConnectionQuality>('unknown');

  const getQualityFromStats = useCallback((rtt: number, packetLoss: number): ConnectionQuality => {
    if (rtt < 100 && packetLoss < 1) return 'excellent';
    if (rtt < 200 && packetLoss < 3) return 'good';
    if (rtt < 400 && packetLoss < 8) return 'fair';
    return 'poor';
  }, []);

  const collectStats = useCallback(async () => {
    const newStats = new Map<string, ConnectionStats>();
    
    for (const [peerId, pc] of peerConnections.entries()) {
      if (pc.connectionState !== 'connected') continue;
      
      try {
        const report = await pc.getStats();
        let rtt = 0;
        let packetLoss = 0;
        let bitrate = 0;
        let packetsLost = 0;
        let packetsReceived = 0;
        let bytesReceived = 0;
        let lastBytesReceived = 0;

        report.forEach((stat) => {
          if (stat.type === 'candidate-pair' && stat.state === 'succeeded') {
            rtt = stat.currentRoundTripTime ? stat.currentRoundTripTime * 1000 : 0;
          }
          
          if (stat.type === 'inbound-rtp' && stat.kind === 'video') {
            packetsLost = stat.packetsLost || 0;
            packetsReceived = stat.packetsReceived || 0;
            bytesReceived = stat.bytesReceived || 0;
          }
        });

        if (packetsReceived > 0) {
          packetLoss = (packetsLost / (packetsLost + packetsReceived)) * 100;
        }

        // Calcular bitrate aproximado
        const currentStats = stats.get(peerId);
        if (currentStats && bytesReceived > 0) {
          lastBytesReceived = bytesReceived;
          bitrate = ((bytesReceived - (lastBytesReceived || 0)) * 8) / 1000; // kbps
        }

        const quality = getQualityFromStats(rtt, packetLoss);
        
        newStats.set(peerId, {
          quality,
          rtt: Math.round(rtt),
          packetLoss: Math.round(packetLoss * 10) / 10,
          bitrate: Math.round(bitrate)
        });
      } catch (error) {
        console.warn(`Erro ao coletar stats de ${peerId}:`, error);
      }
    }

    setStats(newStats);

    // Calcular qualidade geral
    if (newStats.size === 0) {
      setOverallQuality('unknown');
    } else {
      const qualities = Array.from(newStats.values()).map(s => s.quality);
      const qualityOrder: ConnectionQuality[] = ['poor', 'fair', 'good', 'excellent'];
      const worstQuality = qualities.reduce((worst, current) => {
        return qualityOrder.indexOf(current) < qualityOrder.indexOf(worst) ? current : worst;
      }, 'excellent' as ConnectionQuality);
      setOverallQuality(worstQuality);
    }
  }, [peerConnections, stats, getQualityFromStats]);

  useEffect(() => {
    const interval = setInterval(collectStats, 2000);
    return () => clearInterval(interval);
  }, [collectStats]);

  return { stats, overallQuality };
}

export function getQualityIcon(quality: ConnectionQuality): { icon: string; color: string } {
  switch (quality) {
    case 'excellent':
      return { icon: '📶', color: 'text-green-500' };
    case 'good':
      return { icon: '📶', color: 'text-green-400' };
    case 'fair':
      return { icon: '📶', color: 'text-yellow-500' };
    case 'poor':
      return { icon: '📶', color: 'text-red-500' };
    default:
      return { icon: '📶', color: 'text-gray-400' };
  }
}
