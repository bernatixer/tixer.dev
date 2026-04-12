// Random pastel color generator for tags

const PASTEL_COLORS = [
  '#4ECDC4', '#FF8A65', '#FFD166', '#5C7CFA',
  '#F06292', '#81C784', '#FFB74D', '#90A4AE',
  '#A78BFA', '#F472B6', '#34D399', '#FB923C',
  '#60A5FA', '#C084FC', '#FBBF24', '#6EE7B7',
] as const

export const randomPastel = (): string =>
  PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)]
