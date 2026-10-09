import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  createVerifyBlind,
  isVerifyBlindError,
  type VerificationResult,
} from '@verifyblind/react-native';

// Public test partner (same as the native demo apps). Its generate proxy and verify endpoint
// live at test.verifyblind.com; its Partner Portal "App Return Scheme" is `verifyblinddemo`.
const PARTNER_BACKEND_URL = 'https://test.verifyblind.com/api';
const SERVER_VERIFY_URL = 'https://test.verifyblind.com/api/verify';
const RETURN_URL = 'verifyblinddemo://callback';

const POLL_INTERVAL_MS = 1000;
const MAX_POLLS = 60;

type Status =
  | { kind: 'idle' }
  | { kind: 'busy'; text: string }
  | { kind: 'ok'; text: string }
  | { kind: 'error'; text: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Sends the signed token to the server. The server decides; the phone never does. */
async function verifyOnServer(token: string): Promise<string | null> {
  const res = await fetch(SERVER_VERIFY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  let body: { success?: boolean; error?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (res.ok && body?.success === true) return null;
  return body?.error || `HTTP ${res.status}`;
}

export default function App() {
  const vb = useMemo(
    () =>
      createVerifyBlind({
        partnerBackendUrl: PARTNER_BACKEND_URL,
        generateEndpoint: 'generate',
      }),
    []
  );
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const nonceRef = useRef<string | null>(null);
  const pollingRef = useRef(false);

  useEffect(() => () => vb.release(), [vb]);

  const finish = useCallback(async (result: VerificationResult) => {
    // Do NOT read or log the result fields here (user_id, nsbd_id, doc_id ...).
    if (!result.token) {
      setStatus({ kind: 'error', text: 'No token in result (old SDK?)' });
      return;
    }
    setStatus({ kind: 'busy', text: 'Checking on the server...' });
    try {
      const failure = await verifyOnServer(result.token);
      setStatus(
        failure
          ? { kind: 'error', text: `Server rejected: ${failure}` }
          : { kind: 'ok', text: 'Verified by server' }
      );
    } catch (e) {
      setStatus({
        kind: 'error',
        text: `Server unreachable: ${(e as Error).message}`,
      });
    }
  }, []);

  /** Polls only while the app is in the foreground (same as the native demo apps). */
  const poll = useCallback(async () => {
    const nonce = nonceRef.current;
    if (!nonce || pollingRef.current) return;
    pollingRef.current = true;
    setStatus({ kind: 'busy', text: 'Waiting for VerifyBlind...' });
    try {
      for (let i = 0; i < MAX_POLLS; i++) {
        if (AppState.currentState !== 'active' || nonceRef.current !== nonce)
          return;
        const result = await vb.checkVerificationResult(nonce);
        if (result) {
          nonceRef.current = null;
          await finish(result);
          return;
        }
        await sleep(POLL_INTERVAL_MS);
      }
      setStatus({ kind: 'error', text: 'Timed out. Try again.' });
      nonceRef.current = null;
    } catch (e) {
      nonceRef.current = null;
      if (isVerifyBlindError(e) && e.code === 'USER_CANCELLED') {
        setStatus({ kind: 'error', text: `Cancelled (${e.cancelReason})` });
      } else if (isVerifyBlindError(e)) {
        setStatus({ kind: 'error', text: `[${e.code}] ${e.message}` });
      } else {
        setStatus({ kind: 'error', text: String(e) });
      }
    } finally {
      pollingRef.current = false;
    }
  }, [vb, finish]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') poll();
    });
    return () => sub.remove();
  }, [poll]);

  const start = async () => {
    setStatus({ kind: 'busy', text: 'Opening VerifyBlind...' });
    try {
      // In a real app your server's generate proxy decides what to ask for.
      const { nonce } = await vb.startAuthentication({
        validations: { age: '18+' },
        returnUrl: RETURN_URL,
      });
      nonceRef.current = nonce;
      // Polling starts when the app becomes active again (AppState listener).
    } catch (e) {
      const text = isVerifyBlindError(e)
        ? `[${e.code}] ${e.message}`
        : String(e);
      setStatus({ kind: 'error', text });
    }
  };

  const cancel = () => {
    nonceRef.current = null;
    setStatus({ kind: 'idle' });
  };

  const busy = status.kind === 'busy';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>VerifyBlind React Native example</Text>
      <Text style={styles.subtitle}>
        Asks for age 18+ against the public test partner.
      </Text>

      <Pressable
        style={[styles.button, busy && styles.buttonDisabled]}
        disabled={busy}
        onPress={start}
      >
        <Text style={styles.buttonText}>Verify with VerifyBlind</Text>
      </Pressable>

      {busy && (
        <View style={styles.row}>
          <ActivityIndicator />
          <Text style={styles.statusText}>{status.text}</Text>
          <Pressable onPress={cancel}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      )}
      {status.kind === 'ok' && (
        <Text style={[styles.statusText, styles.ok]}>{status.text}</Text>
      )}
      {status.kind === 'error' && (
        <Text style={[styles.statusText, styles.error]}>{status.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
    backgroundColor: '#0f172a',
  },
  title: { fontSize: 20, fontWeight: '600', color: '#f8fafc' },
  subtitle: { fontSize: 14, color: '#cbd5e1', textAlign: 'center' },
  button: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  statusText: { fontSize: 15, color: '#e2e8f0', textAlign: 'center' },
  ok: { color: '#4ade80', fontWeight: '600' },
  error: { color: '#f87171' },
  link: { color: '#93c5fd', textDecorationLine: 'underline' },
});
