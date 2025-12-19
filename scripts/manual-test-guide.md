# Manual Test Guide for Video Chat Application

## Server Status
✅ Local server running at: http://localhost:3000
✅ WebSocket URL: wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod

## Test Steps

### 1. Homepage Test
- Open http://localhost:3000
- Should see: "Chat Colaborativo por Vídeo" title
- Should see: "Criar Nova Sala" button
- Should see: Room ID input field

### 2. Create Room Test
- Click "Criar Nova Sala" button
- Should navigate to `/room/room_XXXXXXXXX`
- Should see: Chat interface with sidebar
- Should see: WebSocket connection status in header
- Check browser console for WebSocket logs

### 3. WebSocket Connection Test
- In browser console, look for:
  - `[WebSocket] Conectando em: wss://...`
  - `[WebSocket] ✅ Conectado com sucesso!`
- Header should show green connection indicator

### 4. Participants Test
- Open same room URL in another browser tab/window
- Both tabs should show:
  - Updated participant count
  - User join notifications
  - Participants list in sidebar

### 5. Chat Test
- Send messages in one tab
- Should appear in other tab
- Messages should show user ID and timestamp

### 6. Video/Audio Test
- Allow camera/microphone permissions
- Video should appear in video panel
- Controls should work (mute/unmute, video on/off)

## Expected Logs in Browser Console

```
[WebSocket] Conectando em: wss://kb09dca09l.execute-api.us-east-1.amazonaws.com/prod?userId=user_XXXXX&roomId=room_XXXXX
[WebSocket] ✅ Conectado com sucesso!
[WebSocket] Mensagem recebida: {type: "room_event", data: {...}}
[WebSocket] Evento da sala: {eventType: "user_joined", userId: "user_XXXXX", ...}
```

## Troubleshooting

### WebSocket Connection Failed
- Check if AWS API Gateway is accessible
- Verify WebSocket URL in .env file
- Check browser network tab for connection errors

### Participants Not Showing
- Verify room_event messages are received
- Check if participants state is updated
- Ensure Sidebar component receives participants prop

### Video Not Working
- Check browser permissions for camera/microphone
- Verify WebRTC implementation in useVideoCall hook
- Check for getUserMedia errors in console

## Current Status
- ✅ All TypeScript errors fixed
- ✅ Deprecated substr() replaced with substring()
- ✅ Server running on http://localhost:3000
- ✅ WebSocket configuration verified
- ✅ Both interfaces available:
  - Original: `/room/:roomId` (fully functional)
  - New: `/lobby` and `/meeting/:roomId` (preview)