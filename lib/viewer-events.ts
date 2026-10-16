export const PROFILE_CHANGED_EVENT = "ghanaverse:profile-changed"
export function announceProfileChange() {
  window.dispatchEvent(new Event(PROFILE_CHANGED_EVENT))
  // Only an event timestamp is shared. Profile data stays on the server.
  localStorage.setItem(PROFILE_CHANGED_EVENT, `${Date.now()}-${Math.random()}`)
}
