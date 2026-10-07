function createPermissionRequester({ preferences, nativeRequest }) {
  let pending = null;
  return function requestPermissions() {
    if (pending) return pending;
    pending = (async () => {
      const result = {};
      for (const type of ['camera', 'microphone']) {
        const status = preferences.getMediaAccessStatus(type);
        if (status === 'not-determined') await preferences.askForMediaAccess(type);
        result[type] = preferences.getMediaAccessStatus(type);
      }
      const native = await nativeRequest();
      return { ...result, ...native };
    })().finally(() => { pending = null; });
    return pending;
  };
}
module.exports = { createPermissionRequester };
