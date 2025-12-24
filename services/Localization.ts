import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// In a full production environment, these would be separate JSON files fetched via CDN.
// For this contained environment, we define them here to ensure immediate functionality.
const resources = {
  en: {
    translation: {
      "app_title": "TANK WARFARE",
      "subtitle": "NEON ERA",
      "label_callsign": "CALLSIGN",
      "placeholder_name": "Enter your name...",
      "label_best": "PERSONAL BEST",
      "btn_deploy": "DEPLOY",
      "controls_desktop": "WASD to Move • Mouse to Aim • Click to Shoot",
      "controls_mobile": "Left Stick Move • Right Stick Aim/Shoot",
      "score": "Score",
      "level": "Lvl {{level}} Tank",
      "leaderboard": "LEADERBOARD",
      "auto_pilot": "AUTO-PILOT ENABLED",
      "you_died": "YOU DIED",
      "respawning": "Respawning...",
      "stat_regen": "Regen",
      "stat_health": "Max Health",
      "stat_body_dmg": "Body Dmg",
      "stat_bullet_spd": "Bullet Spd",
      "stat_bullet_pen": "Bullet Pen",
      "stat_bullet_dmg": "Bullet Dmg",
      "stat_reload": "Reload",
      "stat_move_spd": "Move Spd",
      "bot_tag": "BOT",
      "points_avail": "Available Points"
    }
  },
  th: {
    translation: {
      "app_title": "สงครามรถถัง",
      "subtitle": "ยุคนีออน",
      "label_callsign": "รหัสเรียกขาน",
      "placeholder_name": "กรอกชื่อของคุณ...",
      "label_best": "สถิติสูงสุด",
      "btn_deploy": "เริ่มภารกิจ",
      "controls_desktop": "WASD เดิน • เมาส์เล็ง • คลิกยิง",
      "controls_mobile": "ซ้ายเดิน • ขวาเล็ง/ยิง",
      "score": "คะแนน",
      "level": "รถถัง เวล {{level}}",
      "leaderboard": "อันดับสูงสุด",
      "auto_pilot": "เปิดระบบออโต้",
      "you_died": "ภารกิจล้มเหลว",
      "respawning": "กำลังเกิดใหม่...",
      "stat_regen": "ฟื้นฟู",
      "stat_health": "เลือด",
      "stat_body_dmg": "ชนแรง",
      "stat_bullet_spd": "กระสุนไว",
      "stat_bullet_pen": "เจาะเกราะ",
      "stat_bullet_dmg": "ยิงแรง",
      "stat_reload": "รีโหลด",
      "stat_move_spd": "ความเร็ว",
      "bot_tag": "บอท",
      "points_avail": "แต้มอัพเกรด"
    }
  },
  jp: {
    translation: {
      "app_title": "タンクウォーフェア",
      "subtitle": "ネオン・エラ",
      "label_callsign": "コールサイン",
      "placeholder_name": "名前を入力...",
      "label_best": "自己ベスト",
      "btn_deploy": "出撃",
      "controls_desktop": "WASD 移動 • マウス 照準 • クリック 発射",
      "controls_mobile": "左スティック 移動 • 右スティック 射撃",
      "score": "スコア",
      "level": "Lv {{level}} タンク",
      "leaderboard": "リーダーボード",
      "auto_pilot": "自動操縦",
      "you_died": "作戦失敗",
      "respawning": "リスポーン中...",
      "stat_regen": "回復",
      "stat_health": "体力",
      "stat_body_dmg": "体当たり",
      "stat_bullet_spd": "弾速",
      "stat_bullet_pen": "貫通力",
      "stat_bullet_dmg": "攻撃力",
      "stat_reload": "装填",
      "stat_move_spd": "移動速度",
      "bot_tag": "CPU",
      "points_avail": "強化ポイント"
    }
  },
  fr: {
    translation: {
      "app_title": "GUERRE DES CHARS",
      "subtitle": "ÈRE NÉON",
      "label_callsign": "INDICATIF",
      "placeholder_name": "Votre nom...",
      "label_best": "MEILLEUR SCORE",
      "btn_deploy": "DÉPLOYER",
      "controls_desktop": "WASD Bouger • Souris Viser • Clic Tirer",
      "controls_mobile": "Gauche Bouger • Droite Tirer",
      "score": "Score",
      "level": "Char Niv {{level}}",
      "leaderboard": "CLASSEMENT",
      "auto_pilot": "PILOTE AUTO",
      "you_died": "VOUS ÊTES MORT",
      "respawning": "Réapparition...",
      "stat_regen": "Régène",
      "stat_health": "Santé Max",
      "stat_body_dmg": "Dégâts Corps",
      "stat_bullet_spd": "Vitesse Tir",
      "stat_bullet_pen": "Pénétration",
      "stat_bullet_dmg": "Dégâts Tir",
      "stat_reload": "Recharge",
      "stat_move_spd": "Vitesse",
      "bot_tag": "ROBOT",
      "points_avail": "Points Dispo"
    }
  }
};

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false, // React handles escaping
    },
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupLocalStorage: 'tank_lang',
      caches: ['localStorage'],
    }
  });

export default i18next;