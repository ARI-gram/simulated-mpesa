// ============================================================
// WEBAUTHN HELPER
// Thin wrapper around navigator.credentials for biometric
// register + verify. Client-only — challenge is generated
// locally (fine for a simulation).
// ============================================================

const WebAuthn = (() => {
  /**
   * Is WebAuthn supported in this browser?
   */
  function isSupported() {
    return (
      typeof window.PublicKeyCredential !== "undefined" &&
      typeof navigator.credentials !== "undefined" &&
      typeof navigator.credentials.create === "function"
    );
  }

  /**
   * Is there a platform authenticator (Touch ID / Windows Hello)?
   * Returns true/false; rejects if unsupported.
   */
  async function hasPlatformAuthenticator() {
    if (!isSupported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch (_) {
      return false;
    }
  }

  /**
   * Random challenge (32 bytes).
   */
  function makeChallenge() {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    return arr;
  }

  /**
   * Convert an ArrayBuffer to a base64url string.
   */
  function bufToB64url(buf) {
    const bytes = new Uint8Array(buf);
    let bin = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  /**
   * Convert a base64url string back to a Uint8Array.
   */
  function b64urlToBuf(str) {
    const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
    const b64 = (str + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
      bytes[i] = bin.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Register a new biometric credential for a user.
   * Returns { credentialId, rawId, publicKeyAlgorithm } or throws.
   */
  async function register({ userId, userName, userDisplayName }) {
    if (!isSupported()) throw new Error("WebAuthn not supported");

    const challenge = makeChallenge();

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          // In production this should be your real domain.
          // localhost / file:// will still work for a demo.
          name: "Simulated M-PESA",
          id: window.location.hostname || undefined,
        },
        user: {
          id: new TextEncoder().encode(String(userId)),
          name: String(userName || `user-${userId}`),
          displayName: String(userDisplayName || userName || `user-${userId}`),
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // built-in sensor only
          userVerification: "required",
          residentKey: "preferred",
        },
        timeout: 60000,
        attestation: "none",
      },
    });

    if (!cred) throw new Error("Registration cancelled");

    return {
      credentialId: bufToB64url(cred.rawId),
      rawId: bufToB64url(cred.rawId),
      publicKeyAlgorithm: cred.response?.getPublicKeyAlgorithm?.() ?? null,
      createdAt: Date.now(),
    };
  }

  /**
   * Verify an existing credential.
   * Returns true if the user proved identity, throws otherwise.
   */
  async function verify({ credentialId }) {
    if (!isSupported()) throw new Error("WebAuthn not supported");
    if (!credentialId) throw new Error("No stored credential");

    const challenge = makeChallenge();

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: "required",
        allowCredentials: [
          {
            type: "public-key",
            id: b64urlToBuf(credentialId),
            transports: ["internal"],
          },
        ],
      },
    });

    if (!assertion) throw new Error("Verification failed");
    return true;
  }

  /**
   * Remove all stored credentials for the current origin.
   * (Browsers don't expose a public remove API — this is a stub.)
   */
  function isUserCancelled(err) {
    if (!err) return false;
    const name = err.name || "";
    return (
      name === "NotAllowedError" ||
      name === "AbortError" ||
      name === "SecurityError"
    );
  }

  return {
    isSupported,
    hasPlatformAuthenticator,
    register,
    verify,
    isUserCancelled,
  };
})();
