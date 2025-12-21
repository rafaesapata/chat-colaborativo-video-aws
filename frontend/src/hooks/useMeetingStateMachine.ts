/**
 * State Machine para Ciclo de Vida da Reunião
 * Garante transições de estado válidas e previne estados inconsistentes
 */

import { useReducer, useCallback } from 'react';

export type MeetingState =
  | { status: 'idle' }
  | { status: 'joining'; attempt: number }
  | { status: 'connected'; meetingId: string; attendeeId: string }
  | { status: 'reconnecting'; previousState: MeetingState; attempt: number }
  | { status: 'error'; error: string; recoverable: boolean }
  | { status: 'leaving' }
  | { status: 'ended'; reason: 'user_left' | 'meeting_ended' | 'kicked' | 'error' };

export type MeetingAction =
  | { type: 'JOIN_REQUESTED' }
  | { type: 'JOIN_SUCCESS'; meetingId: string; attendeeId: string }
  | { type: 'JOIN_FAILED'; error: string; recoverable: boolean }
  | { type: 'CONNECTION_LOST' }
  | { type: 'RECONNECT_SUCCESS' }
  | { type: 'RECONNECT_FAILED'; attempt: number }
  | { type: 'LEAVE_REQUESTED' }
  | { type: 'LEAVE_COMPLETE' }
  | { type: 'MEETING_ENDED' }
  | { type: 'KICKED' }
  | { type: 'ERROR_DISMISSED' }
  | { type: 'RESET' };

const MAX_RECONNECT_ATTEMPTS = 5;

function meetingReducer(state: MeetingState, action: MeetingAction): MeetingState {
  switch (state.status) {
    case 'idle':
      if (action.type === 'JOIN_REQUESTED') {
        return { status: 'joining', attempt: 1 };
      }
      break;

    case 'joining':
      if (action.type === 'JOIN_SUCCESS') {
        return {
          status: 'connected',
          meetingId: action.meetingId,
          attendeeId: action.attendeeId,
        };
      }
      if (action.type === 'JOIN_FAILED') {
        return {
          status: 'error',
          error: action.error,
          recoverable: action.recoverable,
        };
      }
      break;

    case 'connected':
      if (action.type === 'CONNECTION_LOST') {
        return {
          status: 'reconnecting',
          previousState: state,
          attempt: 1,
        };
      }
      if (action.type === 'LEAVE_REQUESTED') {
        return { status: 'leaving' };
      }
      if (action.type === 'MEETING_ENDED') {
        return { status: 'ended', reason: 'meeting_ended' };
      }
      if (action.type === 'KICKED') {
        return { status: 'ended', reason: 'kicked' };
      }
      break;

    case 'reconnecting':
      if (action.type === 'RECONNECT_SUCCESS') {
        if (state.previousState.status === 'connected') {
          return state.previousState;
        }
        return { status: 'idle' };
      }
      if (action.type === 'RECONNECT_FAILED') {
        if (action.attempt >= MAX_RECONNECT_ATTEMPTS) {
          return { status: 'error', error: 'Conexão perdida', recoverable: true };
        }
        return { ...state, attempt: action.attempt + 1 };
      }
      if (action.type === 'LEAVE_REQUESTED') {
        return { status: 'leaving' };
      }
      break;

    case 'error':
      if (action.type === 'ERROR_DISMISSED') {
        return state.recoverable ? { status: 'idle' } : state;
      }
      if (action.type === 'RESET') {
        return { status: 'idle' };
      }
      break;

    case 'leaving':
      if (action.type === 'LEAVE_COMPLETE') {
        return { status: 'ended', reason: 'user_left' };
      }
      break;

    case 'ended':
      if (action.type === 'RESET') {
        return { status: 'idle' };
      }
      break;
  }

  // Transição inválida - log e manter estado atual
  console.warn('[StateMachine] Transição inválida:', state.status, '->', action.type);
  return state;
}

export function useMeetingStateMachine() {
  const [state, dispatch] = useReducer(meetingReducer, { status: 'idle' });

  // Helpers derivados do estado
  const isJoined = state.status === 'connected';
  const isJoining = state.status === 'joining';
  const isReconnecting = state.status === 'reconnecting';
  const isLeaving = state.status === 'leaving';
  const hasEnded = state.status === 'ended';
  const error = state.status === 'error' ? state.error : null;
  const canRetry = state.status === 'error' && state.recoverable;

  const meetingId = state.status === 'connected' ? state.meetingId : null;
  const attendeeId = state.status === 'connected' ? state.attendeeId : null;

  // Actions
  const requestJoin = useCallback(() => dispatch({ type: 'JOIN_REQUESTED' }), []);
  const joinSuccess = useCallback(
    (meetingId: string, attendeeId: string) =>
      dispatch({ type: 'JOIN_SUCCESS', meetingId, attendeeId }),
    []
  );
  const joinFailed = useCallback(
    (error: string, recoverable = true) =>
      dispatch({ type: 'JOIN_FAILED', error, recoverable }),
    []
  );
  const connectionLost = useCallback(() => dispatch({ type: 'CONNECTION_LOST' }), []);
  const reconnectSuccess = useCallback(() => dispatch({ type: 'RECONNECT_SUCCESS' }), []);
  const reconnectFailed = useCallback(
    (attempt: number) => dispatch({ type: 'RECONNECT_FAILED', attempt }),
    []
  );
  const requestLeave = useCallback(() => dispatch({ type: 'LEAVE_REQUESTED' }), []);
  const leaveComplete = useCallback(() => dispatch({ type: 'LEAVE_COMPLETE' }), []);
  const meetingEnded = useCallback(() => dispatch({ type: 'MEETING_ENDED' }), []);
  const kicked = useCallback(() => dispatch({ type: 'KICKED' }), []);
  const dismissError = useCallback(() => dispatch({ type: 'ERROR_DISMISSED' }), []);
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    state,
    dispatch,
    // Estado derivado
    isJoined,
    isJoining,
    isReconnecting,
    isLeaving,
    hasEnded,
    error,
    canRetry,
    meetingId,
    attendeeId,
    // Actions
    requestJoin,
    joinSuccess,
    joinFailed,
    connectionLost,
    reconnectSuccess,
    reconnectFailed,
    requestLeave,
    leaveComplete,
    meetingEnded,
    kicked,
    dismissError,
    reset,
  };
}
