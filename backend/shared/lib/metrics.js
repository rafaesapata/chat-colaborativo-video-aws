const {
  CloudWatchClient,
  PutMetricDataCommand
} = require('@aws-sdk/client-cloudwatch');

const cloudwatch = new CloudWatchClient({});

const NAMESPACE = 'ChatColaborativo';

const publishMetric = async (metricName, value, dimensions = [], unit = 'Count') => {
  try {
    const params = {
      Namespace: NAMESPACE,
      MetricData: [
        {
          MetricName: metricName,
          Value: value,
          Unit: unit,
          Timestamp: new Date(),
          Dimensions: [
            { Name: 'Environment', Value: process.env.STAGE || 'development' },
            ...dimensions
          ]
        }
      ]
    };

    await cloudwatch.send(new PutMetricDataCommand(params));
  } catch (error) {
    console.error('Error publishing metric:', error);
  }
};

// Métricas de negócio
const metrics = {
  messagesSent: () => publishMetric('MessagesSent', 1),
  messagesPerRoom: (roomId) => publishMetric('MessagesPerRoom', 1, [
    { Name: 'RoomId', Value: roomId }
  ]),
  transcriptionLatency: (ms) => publishMetric('TranscriptionLatency', ms, [], 'Milliseconds'),
  activeConnections: (count) => publishMetric('ActiveConnections', count),
  aiAnalysisRequests: () => publishMetric('AIAnalysisRequests', 1),
  aiAnalysisErrors: () => publishMetric('AIAnalysisErrors', 1),
  webrtcSignalingEvents: (type) => publishMetric('WebRTCSignaling', 1, [
    { Name: 'SignalType', Value: type }
  ]),
  connectionErrors: () => publishMetric('ConnectionErrors', 1),
  validationErrors: () => publishMetric('ValidationErrors', 1),
  sanitizationEvents: () => publishMetric('SanitizationEvents', 1),
  messageLatency: (ms) => publishMetric('MessageLatency', ms, [], 'Milliseconds')
};

module.exports = { metrics };