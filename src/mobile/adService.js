const TEST_IDS = {
  android: {
    rewarded: "ca-app-pub-3940256099942544/5224354917",
    banner: "ca-app-pub-3940256099942544/6300978111"
  }
};

const PROD_IDS = {
  android: {
    rewarded: import.meta.env.VITE_ADMOB_ANDROID_REWARDED || "",
    banner: import.meta.env.VITE_ADMOB_ANDROID_BANNER || ""
  }
};

function getPlatform() {
  try {
    return window.Capacitor?.getPlatform?.() || "web";
  } catch {
    return "web";
  }
}

function getAdMobPlugin() {
  return window.Capacitor?.Plugins?.AdMob || null;
}

export class MobileAdsService {
  constructor() {
    this.adMob = getAdMobPlugin();
    this.platform = getPlatform();
    this.ready = false;
    this.isProdBuild = Boolean(import.meta.env.PROD);

    this.hasProdBannerId = Boolean(PROD_IDS.android.banner);
    this.hasProdRewardedId = Boolean(PROD_IDS.android.rewarded);
    this.hasAnyProdIds = this.hasProdBannerId || this.hasProdRewardedId;
    this.isTestingMode = !this.isProdBuild || !this.hasAnyProdIds;

    this.rewardedUnitId = this.isProdBuild
      ? (this.hasProdRewardedId ? PROD_IDS.android.rewarded : "")
      : TEST_IDS.android.rewarded;
    this.bannerUnitId = this.isProdBuild
      ? (this.hasProdBannerId ? PROD_IDS.android.banner : "")
      : TEST_IDS.android.banner;
  }

  get isAvailable() {
    return Boolean(this.adMob) && this.platform === "android";
  }

  async init() {
    if (!this.isAvailable) {
      return { ok: false, reason: "plugin-missing" };
    }

    try {
      await this.adMob.initialize({
        testingDevices: [],
        initializeForTesting: this.isTestingMode
      });
      this.ready = true;
      return { ok: true };
    } catch {
      return { ok: false, reason: "init-failed" };
    }
  }

  async showBanner() {
    if (!this.ready || !this.isAvailable) return { ok: false, reason: "not-ready" };
    if (!this.bannerUnitId) return { ok: false, reason: "banner-not-configured" };
    try {
      await this.adMob.showBanner({
        adId: this.bannerUnitId,
        position: "BOTTOM_CENTER",
        margin: 0,
        isTesting: this.isTestingMode
      });
      return { ok: true };
    } catch {
      return { ok: false, reason: "banner-failed" };
    }
  }

  async showRewarded() {
    if (!this.ready || !this.isAvailable) return { ok: false, reason: "not-ready" };
    if (!this.rewardedUnitId) return { ok: false, reason: "rewarded-not-configured" };
    try {
      await this.adMob.prepareRewardVideoAd({
        adId: this.rewardedUnitId,
        isTesting: this.isTestingMode
      });
      await this.adMob.showRewardVideoAd();
      return { ok: true, rewarded: true };
    } catch {
      return { ok: false, reason: "rewarded-failed" };
    }
  }
}
