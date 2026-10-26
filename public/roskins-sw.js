self.addEventListener('push', event => {
  event.waitUntil((async () => {
    // Generic text protects private chats on the lock screen and after account changes.
    await self.registration.showNotification('Roskins — новое событие', { body: 'Проверь предложения, сообщения и сохранённые поиски на трейд-плазе.', icon: '/pets/turtle.svg', tag: 'roskins-events', data: { url: '/?view=notifications' } });
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const window of windows) window.postMessage({ type: 'ROSKINS_NOTIFICATION' });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => { const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true }); const target = windows.find(window => new URL(window.url).origin === self.location.origin); if (target) { await target.focus(); target.postMessage({ type: 'ROSKINS_OPEN_NOTIFICATIONS' }); } else await self.clients.openWindow('/?view=notifications'); })());
});
