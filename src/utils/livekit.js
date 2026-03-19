const { AccessToken } = require("livekit-server-sdk");

async function generateLiveKitToken(roomName, identity, metadata = {}) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error("LiveKit credentials not configured");
  }

  const { name, ...rest } = metadata;
  const at = new AccessToken(apiKey, apiSecret, {
    identity,
    name: name || identity,
    metadata: JSON.stringify(rest),
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
  });

  return await at.toJwt();
}

module.exports = { generateLiveKitToken };
