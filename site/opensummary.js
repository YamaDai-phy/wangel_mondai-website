//iosかそれ以外かでdawnload-methodを開くか決める
function isIOS() {
  const ua = navigator.userAgent || "";
  const platform = navigator.platform || "";
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

const iosMethod = document.querySelector(".method-ios");
const pcMethod = document.querySelector(".method-pc");
if (isIOS()) {
  if (iosMethod) iosMethod.open = true;
  if (pcMethod) pcMethod.style.display = "none";
} else {
  if (pcMethod) pcMethod.open = true;
  if (iosMethod) iosMethod.style.display = "none";
}
