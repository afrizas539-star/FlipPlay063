// FlipPlay - Script Logic

// State aplikasi
let animeList = [];
let selectedAura = "All";
let hasLoadedAnime = false;
let isLoading = false;
let requestNumber = 0;

// Query GraphQL untuk AniList API
const ANILIST_QUERY = `
query {
  Page(page: 1, perPage: 24) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        english
        romaji
        native
      }
      coverImage {
        large
        medium
      }
      description
      genres
      averageScore
      episodes
      format
      siteUrl
    }
  }
}
`;

function init() {
  const animeGrid = document.getElementById("animeGrid");
  const searchInput = document.getElementById("searchInput");
  const searchButton = document.getElementById("searchButton");
  const statusText = document.getElementById("status");
  const retryButton = document.getElementById("retryButton");
  const auraButtons = document.querySelectorAll(".aura-btn");
  const vibeSection = document.getElementById("vibe");
  const animeCategory = document.getElementById("animeCategory");
  const backButton = document.getElementById("backButton");
  const contactForm = document.getElementById("contactForm");
  const contactStatus = document.getElementById("contactStatus");

  if (!animeCategory || !vibeSection || !animeGrid) {
    console.error("Elemen utama FlipPlay tidak ditemukan di DOM.");
    return;
  }

  // Event klik card Anime: Buka section #vibe, scroll, dan fetch data
  animeCategory.addEventListener("click", (event) => {
    event.preventDefault();

    vibeSection.classList.remove("hidden");
    vibeSection.scrollIntoView({ behavior: "smooth" });

    if (!hasLoadedAnime && !isLoading) {
      getAnime();
    }
  });

  // Tombol Kembali ke Explore
  if (backButton) {
    backButton.addEventListener("click", () => {
      vibeSection.classList.add("hidden");

      const contentSection = document.getElementById("content");
      if (contentSection) {
        contentSection.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

  // Fungsi mengambil data anime dari API
  async function getAnime() {
    const currentRequest = ++requestNumber;
    isLoading = true;

    if (statusText) {
      statusText.textContent = "Loading data anime...";
    }
    if (retryButton) {
      retryButton.hidden = true;
      retryButton.disabled = true;
    }

    animeGrid.innerHTML = `
      <div class="col-span-full rounded-xl bg-gray-900 p-8 text-center text-gray-400">
        <p class="text-lg">⏳ Sedang mengambil data anime...</p>
      </div>
    `;

    try {
      if (!navigator.onLine) {
        throw new Error("OFFLINE");
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      let response;
      try {
        response = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ query: ANILIST_QUERY }),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const result = await response.json();

      if (currentRequest !== requestNumber) return;

      const mediaItems = result?.data?.Page?.media;
      if (!Array.isArray(mediaItems) || mediaItems.length === 0) {
        throw new Error("Data anime tidak tersedia.");
      }

      // Normalisasi data API agar sesuai dengan template kartu anime
      animeList = mediaItems.map((anime) => {
        const rawDesc = anime.description || "Belum ada sinopsis.";
        const cleanDesc = rawDesc
          .replace(/<[^>]*>/g, "")
          .replace(/\s+/g, " ")
          .trim();

        return {
          id: anime.id,
          title: anime.title?.english || anime.title?.romaji || anime.title?.native || "Judul tidak tersedia",
          image: anime.coverImage?.large || anime.coverImage?.medium || "",
          synopsis: cleanDesc || "Belum ada sinopsis.",
          genres: (anime.genres || []).map((g) => ({ name: g })),
          score: anime.averageScore ? (anime.averageScore / 10).toFixed(1) : "N/A",
          episodes: anime.episodes ?? "?",
          type: anime.format || "Anime",
          url: anime.siteUrl || (anime.id ? `https://anilist.co/anime/${anime.id}` : "")
        };
      });

      hasLoadedAnime = true;
      showAnime();
    } catch (error) {
      if (currentRequest !== requestNumber) return;

      console.error("Gagal mengambil anime:", error);

      animeList = [];
      hasLoadedAnime = false;

      const isOffline = !navigator.onLine || error.message === "OFFLINE";

      if (statusText) {
        statusText.textContent = isOffline
          ? "Internet terputus. Periksa koneksi internet."
          : "Data gagal dimuat. Coba lagi beberapa saat.";
      }

      animeGrid.innerHTML = `
        <div class="col-span-full rounded-xl border border-red-900 bg-gray-900 p-8 text-center">
          <h3 class="font-bold text-red-300">
            ${isOffline ? "Internet Terputus!" : "Anime tidak dapat dimuat"}
          </h3>
          <p class="mt-2 text-gray-400">
            ${isOffline ? "Hubungkan ke internet untuk memuat koleksi anime." : "Terjadi kesalahan saat memuat data anime. Silakan periksa koneksi atau coba lagi nanti."}
          </p>
        </div>
      `;

      if (retryButton) {
        retryButton.hidden = false;
      }
    } finally {
      isLoading = false;
      if (currentRequest === requestNumber && retryButton) {
        retryButton.disabled = false;
      }
    }
  }

  // Tampilkan daftar anime berdasarkan keyword pencarian dan Aura
  function showAnime() {
    if (!hasLoadedAnime) return;

    const keyword = (searchInput?.value || "").toLowerCase().trim();

    const filteredAnime = animeList.filter((anime) => {
      const title = (anime.title || "").toLowerCase();
      const genres = (anime.genres || []).map((genre) => genre.name);

      const matchSearch = title.includes(keyword);
      let matchAura = true;

      if (selectedAura === "High Energy") {
        matchAura = genres.some((genre) =>
          ["Action", "Adventure", "Sports"].includes(genre)
        );
      } else if (selectedAura === "Melancholy") {
        matchAura = genres.some((genre) =>
          ["Drama", "Romance"].includes(genre)
        );
      } else if (selectedAura === "Binge Mode") {
        matchAura = Number(anime.episodes) >= 24;
      }

      return matchSearch && matchAura;
    });

    if (statusText) {
      statusText.textContent = `Menampilkan ${filteredAnime.length} dari ${animeList.length} anime`;
    }

    if (filteredAnime.length === 0) {
      animeGrid.innerHTML = `
        <div class="col-span-full rounded-xl bg-gray-900 p-10 text-center">
          <p class="text-3xl">🔎</p>
          <h3 class="mt-3 text-lg font-bold">Anime tidak ditemukan</h3>
          <p class="mt-2 text-gray-400">Coba kata kunci atau Aura lain.</p>
        </div>
      `;
      return;
    }

    animeGrid.innerHTML = filteredAnime.map((anime) => {
      const title = anime.title || "Judul tidak tersedia";
      const image = anime.image || "";
      const synopsis = anime.synopsis || "Belum ada sinopsis.";
      const description = synopsis.length > 100
        ? synopsis.slice(0, 100) + "..."
        : synopsis;
      const genres = (anime.genres || []).slice(0, 2);
      const score = anime.score ?? "N/A";
      const episodes = anime.episodes ?? "?";
      const type = anime.type || "Anime";
      const detailUrl = anime.url || "";

      return `
        <article class="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 transition hover:-translate-y-1 hover:border-purple-500">
          ${
            image
              ? `<img src="${image}" alt="${title}" loading="lazy" class="h-64 w-full bg-gray-800 object-cover">`
              : `<div class="flex h-64 items-center justify-center bg-gray-800 text-gray-400">Gambar tidak tersedia</div>`
          }

          <div class="p-5">
            <div class="mb-3 flex flex-wrap gap-2">
              ${genres.map((genre) => `
                <span class="rounded-full bg-purple-950 px-3 py-1 text-xs text-purple-300">
                  ${genre.name}
                </span>
              `).join("")}
            </div>

            <h3 class="text-lg font-bold">${title}</h3>

            <p class="mt-2 text-sm leading-6 text-gray-400">
              ${description}
            </p>

            <div class="mt-4 flex items-center justify-between border-t border-gray-800 pt-4">
              <span class="text-sm font-semibold text-purple-400">
                ★ ${score}
              </span>

              <span class="text-xs text-gray-500">
                ${type} · ${episodes} eps
              </span>
            </div>

            ${
              detailUrl
                ? `<a href="${detailUrl}" target="_blank" rel="noopener noreferrer" class="mt-4 block rounded-lg bg-purple-600 py-2 text-center text-sm font-semibold hover:bg-purple-700">Lihat Detail ↗</a>`
                : `<p class="mt-4 text-center text-sm text-gray-500">Detail tidak tersedia</p>`
            }
          </div>
        </article>
      `;
    }).join("");
  }

  // Pencarian real-time dan submit tombol / Enter
  if (searchInput) {
    searchInput.addEventListener("input", showAnime);
    searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (hasLoadedAnime) {
          showAnime();
        } else if (!isLoading) {
          getAnime();
        }
      }
    });
  }

  if (searchButton) {
    searchButton.addEventListener("click", () => {
      if (hasLoadedAnime) {
        showAnime();
      } else if (!isLoading) {
        getAnime();
      }
    });
  }

  // Filter Aura
  auraButtons.forEach((button) => {
    button.addEventListener("click", () => {
      selectedAura = button.dataset.aura;

      auraButtons.forEach((btn) => {
        const active = btn.dataset.aura === selectedAura;
        btn.classList.toggle("bg-purple-600", active);
        btn.classList.toggle("text-white", active);
        btn.classList.toggle("border-gray-700", !active);
        btn.classList.toggle("bg-gray-900", !active);
      });

      showAnime();
    });
  });

  // Tombol retry / coba lagi
  if (retryButton) {
    retryButton.addEventListener("click", () => {
      if (!isLoading) {
        getAnime();
      }
    });
  }

  // Event Offline & Online
  window.addEventListener("offline", () => {
    if (statusText) {
      statusText.textContent = "Internet terputus.";
    }
    if (!hasLoadedAnime) {
      animeGrid.innerHTML = `
        <div class="col-span-full rounded-xl border border-red-900 bg-gray-900 p-8 text-center">
          <h3 class="font-bold text-red-300">Internet Terputus!</h3>
          <p class="mt-2 text-gray-400">Hubungkan internet untuk memuat koleksi anime.</p>
        </div>
      `;
      if (retryButton) {
        retryButton.hidden = false;
        retryButton.disabled = false;
      }
    }
  });

  window.addEventListener("online", () => {
    if (!vibeSection.classList.contains("hidden") && !hasLoadedAnime && !isLoading) {
      getAnime();
    }
  });

  // Simulasi submit form kontak
  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();
      if (contactStatus) {
        contactStatus.textContent =
          "Terima kasih! Form berhasil diperiksa, tetapi belum terhubung ke layanan pengiriman pesan.";
      }
      contactForm.reset();
    });
  }
}

// Inisialisasi saat DOM siap
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

