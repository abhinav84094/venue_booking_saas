// Owners can choose any brand color; readable foregrounds are derived from it.
export function venueColors(color, appearance = "light") {
  const hex = /^#[a-f\d]{6}$/i.test(color) ? color : "#876d46";
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const luminance = (values) =>
    values
      .map((v) => {
        const c = v / 255;
        return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const backgroundLuminance = luminance(rgb);
  const darkContrast = (backgroundLuminance + 0.05) / (luminance([20, 44, 32]) + 0.05);
  const whiteContrast = 1.05 / (backgroundLuminance + 0.05);
  const foreground = darkContrast >= 4.5 ? "#142c20" : whiteContrast >= 4.5 ? "#ffffff" : "#000000";
  const text = [...rgb];
  if (appearance === "dark") {
    // The accent appears on both page and cards; satisfy the brightest dark surface.
    const surface = luminance([32, 46, 35]);
    while ((luminance(text) + 0.05) / (surface + 0.05) < 4.5)
      for (let i = 0; i < 3; i++) text[i] = Math.min(255, text[i] + 1);
  } else {
    while (luminance(text) > 0.115) for (let i = 0; i < 3; i++) text[i] = Math.max(0, text[i] - 1);
  }
  return {
    "--venue-accent": hex,
    "--venue-foreground": foreground,
    "--venue-text-accent": "#" + text.map((v) => v.toString(16).padStart(2, "0")).join(""),
  };
}
