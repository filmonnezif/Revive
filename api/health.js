module.exports = (_req, res) => {
  res.status(200).json({
    ok: true,
    service: 'revive-api',
    timestamp: new Date().toISOString()
  });
};
