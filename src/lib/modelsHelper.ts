export const mapModelsList = (apiModels: string[], favs: string[]) => {
  return apiModels.map((m: string) => {
    let name = m;
    let desc = "OpenCode model";
    if (m === "deepseek-v4-flash-free") {
      name = "DeepSeek V4 Flash";
      desc = "Fastest performance with intelligence";
    } else if (m === "gemini-3.5-flash") {
      name = "Gemini 3.5 Flash";
      desc = "Fastest for quick answers";
    } else if (m === "claude-sonnet-4") {
      name = "Claude 4.6 Sonnet";
      desc = "Most efficient for everyday tasks";
    } else if (m === "mimo-v2.5-free") {
      name = "Mimo 2.5 Free";
      desc = "Multimodal vision understanding model";
    }

    return {
      name,
      desc,
      isFavourite: favs.includes(m) || m === "deepseek-v4-flash-free",
      api_key: m,
    };
  });
};
