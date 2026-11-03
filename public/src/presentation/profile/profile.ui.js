import { byId } from "../../shared/dom.js";
import { formatShortDateTime } from "../../shared/date-time.js";

export function initProfileUi(profileService) {
  const avatar = byId("profile-avatar");
  const name = byId("profile-name");
  const email = byId("profile-email");
  const since = byId("profile-since");
  let user = null;

  function render(profile) {
    name.textContent = profile?.displayName || "Sin nombre";
    email.textContent = user?.email ?? "";
    since.textContent = profile?.createdAt ? `Miembro desde ${formatShortDateTime(profile.createdAt)}` : "";
    avatar.hidden = !profile?.photo;
    if (profile?.photo) avatar.src = profile.photo;
  }

  profileService.subscribe(render);

  return {
    setUser(nextUser) {
      user = nextUser;
      render(profileService.getProfile());
    },
  };
}