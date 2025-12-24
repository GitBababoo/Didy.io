export const saveHighScore = async (score: number) => {
  // Simple wrapper around localStorage for demo, 
  // replacing full IndexedDB complexity for this scope
  const current = localStorage.getItem('tank_highscore');
  if (!current || parseInt(current) < score) {
    localStorage.setItem('tank_highscore', score.toString());
  }
};

export const getHighScore = (): number => {
  return parseInt(localStorage.getItem('tank_highscore') || '0');
};

export const saveNickname = (name: string) => {
    localStorage.setItem('tank_nickname', name);
}

export const getNickname = (): string => {
    return localStorage.getItem('tank_nickname') || '';
}