/** Badge flagging a quest-related action (offer/progress/unread), styled like the in-world "!" overhead indicator. */
export function createQuestMarker(): HTMLSpanElement {
  const marker = document.createElement('span')
  marker.className = 'quest-marker'
  marker.textContent = '!'
  marker.setAttribute('aria-hidden', 'true')
  return marker
}
