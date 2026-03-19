const { AccessToken } = require("livekit-server-sdk");

function generateLiveKitToken(roomName, identity, metadata = {}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials not configured");
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    metadata: JSON.stringify(metadata),
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return at.toJwt();
}

module.exports = { generateLiveKitToken };
