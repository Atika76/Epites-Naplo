window.EPITESNAPLO_CONFIG = {
  mode: "live",
  supabaseUrl: "https://tcmihuwjlapfaonihdma.supabase.co",
  supabaseAnonKey: "sb_publishable_TC5UHGi1CZGVFnz2py1HiQ_fn-wxy81",
  adminEmail: "cegweb26@gmail.com",
  proDays: 30
};

const supabaseClient = window.supabase.createClient(
  window.EPITESNAPLO_CONFIG.supabaseUrl,
  window.EPITESNAPLO_CONFIG.supabaseAnonKey
);
window.supabaseDirect = supabaseClient;

function friendlySupabaseError(error, fallback = "Supabase művelet sikertelen.") {
  const raw = String(error?.message || error || "");
  if (/failed to fetch|networkerror|load failed|fetch/i.test(raw)) {
    return "Nem sikerült kapcsolódni a Supabase-hoz. Ellenőrizd az internetet, a Supabase projektet és hogy a böngésző nem blokkolja-e a supabase.co kéréseket.";
  }
  if (/payload|too large|413|request entity/i.test(raw)) {
    return "Túl nagy a menteni próbált adat. A fotók automatikusan tömörítve lesznek, de próbálj kevesebb vagy kisebb képet feltölteni.";
  }
  return raw || fallback;
}

function isMissingSupabaseObject(error) {
  const raw = String(error?.message || error || "");
  return /does not exist|schema cache|column .* not found|relation .* does not exist|42P01|42703/i.test(raw);
}

function collectVideoStoragePaths(value, paths = new Set()) {
  if (!value) return paths;
  if (Array.isArray(value)) {
    value.forEach(item => collectVideoStoragePaths(item, paths));
    return paths;
  }
  if (typeof value === "object") {
    if (typeof value.path === "string" && value.path.trim()) paths.add(value.path.trim());
    ["videos", "videoUrls", "video_urls", "supplements"].forEach(key => collectVideoStoragePaths(value[key], paths));
    return paths;
  }
  if (typeof value === "string") {
    const raw = value.trim();
    if (!raw || raw.startsWith("data:")) return paths;
    const marker = "/project-videos/";
    const idx = raw.indexOf(marker);
    if (idx >= 0) {
      const path = raw.slice(idx + marker.length).split("?")[0];
      if (path) paths.add(decodeURIComponent(path));
    }
  }
  return paths;
}

async function deleteProjectRows(table, filters = []) {
  let query = supabaseClient.from(table).delete();
  filters.forEach(([column, value]) => {
    query = query.eq(column, value);
  });
  const { error } = await query;
  if (error && !isMissingSupabaseObject(error)) {
    const message = friendlySupabaseError(error, `${table} törlése nem sikerült.`);
    throw new Error(`${table}: ${message}`);
  }
}

window.EpitesNaploAPI = {
  async getCurrentUser() {
    const { data } = await supabaseClient.auth.getUser();
    return data?.user || null;
  },

  async getSession() {
    const { data } = await supabaseClient.auth.getSession();
    return data?.session || null;
  },

  async signInWithPassword(email, password) {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    return data;
  },

  async signUpWithPassword(email, password, name) {
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: { full_name: name || "Felhasználó" }
      }
    });

    if (error) throw error;

    // Ha Supabase email confirm be van kapcsolva, session még nem biztos hogy lesz.
    return {
      ...data,
      needsEmailConfirm: !data?.session
    };
  },

  async signInOrSignUp(email, name) {
    const { data, error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin + window.location.pathname,
        data: { full_name: name || "Felhasználó" }
      }
    });

    if (error) throw error;
    return data || { email, name };
  },

  async clearAuthStorage() {
    try {
      Object.keys(localStorage).forEach((key) => {
        const k = key.toLowerCase();
        if (key.startsWith("sb-") || k.includes("supabase") || k.includes("epitesnaplo_last_user")) localStorage.removeItem(key);
      });
      Object.keys(sessionStorage).forEach((key) => {
        const k = key.toLowerCase();
        if (key.startsWith("sb-") || k.includes("supabase")) sessionStorage.removeItem(key);
      });
    } catch (_) {}

    try {
      if (window.caches) {
        const names = await caches.keys();
        await Promise.all(names.filter(n => n.toLowerCase().includes("epitesnaplo") || n.toLowerCase().includes("supabase")).map(n => caches.delete(n)));
      }
    } catch (_) {}

    return true;
  },

  async signOut(options = {}) {
    try {
      const { error } = await supabaseClient.auth.signOut({ scope: "local" });
      if (error) console.warn("Supabase local kijelentkezési figyelmeztetés:", error);
    } catch (error) {
      console.warn("Supabase local kijelentkezési figyelmeztetés:", error);
    }

    try {
      await supabaseClient.auth.signOut({ scope: "global" });
    } catch (error) {
      console.warn("Supabase global kijelentkezési figyelmeztetés:", error);
    }

    await this.clearAuthStorage();

    if (!options.silent) alert("Kijelentkezve.");
    return true;
  },



  async resetPassword(email, redirectTo) {
    const { data, error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectTo || (window.location.origin + '/reset-password.html')
    });
    if (error) throw error;
    return data;
  },

  async updatePassword(newPassword) {
    const { data, error } = await supabaseClient.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return data;
  },
  async getProfile() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.warn("Profil betöltési hiba:", error);
      return { full_name: user.user_metadata?.full_name || user.email, email: user.email };
    }

    return data || { full_name: user.user_metadata?.full_name || user.email, email: user.email };
  },



  async isCurrentUserAdmin() {
    const user = await this.getCurrentUser();
    if (!user) return false;
    if (user.email === window.EPITESNAPLO_CONFIG.adminEmail) return true;

    try {
      const { data, error } = await supabaseClient.rpc("is_current_user_admin");
      if (!error && data === true) return true;
    } catch (_) {}

    const profile = await this.getProfile();
    return !!profile?.is_admin;
  },

  async getSubscription() {
    const user = await this.getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabaseClient
      .from("subscriptions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!error && data) return data;

    // V26: pénztermelő fallback – ha a subscriptions tábla még nincs feltöltve,
    // a profiles.plan alapján is működjön a csomaglogika.
    try {
      const profile = await this.getProfile();
      if (profile?.plan && profile.plan !== "free") {
        return {
          user_id: user.id,
          plan: profile.plan,
          status: profile.plan_status || "active",
          current_period_end: profile.plan_expires_at || null
        };
      }
    } catch (_) {}

    return { user_id: user.id, plan: "trial", status: "active" };
  },

  async activateProViaEdge(orderId) {
    const session = await this.getSession();
    if (!session?.access_token) {
      alert("Fizetés előtt jelentkezz be.");
      return null;
    }

    const response = await fetch(`${window.EPITESNAPLO_CONFIG.supabaseUrl}/functions/v1/paypal-activate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ orderId })
    });

    const result = await response.json();

    if (!response.ok) {
      alert("Pro aktiválási hiba: " + (result.error || "ismeretlen hiba"));
      return null;
    }

    alert("Sikeres fizetés! A Pro csomag automatikusan aktiválva.");
    return result.subscription;
  },


  async getAiCredits() {
    const user = await this.getCurrentUser();
    if (!user) return 0;
    const { data, error } = await supabaseClient
      .from("ai_credit_accounts")
      .select("credits")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) {
      console.warn("AI kredit lekérés hiba:", error);
      return 0;
    }
    return Number(data?.credits || 0);
  },

  async activateAiCreditsViaEdge(orderId, credits, amount) {
    const session = await this.getSession();
    if (!session?.access_token) throw new Error("Nincs bejelentkezve.");

    const response = await fetch(`${window.EPITESNAPLO_CONFIG.supabaseUrl}/functions/v1/paypal-ai-credits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`
      },
      body: JSON.stringify({ orderId, credits, amount })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert("AI kredit jóváírási hiba: " + (result.error || "ismeretlen hiba"));
      throw new Error(result.error || "AI kredit jóváírási hiba");
    }
    return result;
  },

  async spendAiCredit(reason = "paid_ai_report", projectId = null) {
    const { data, error } = await supabaseClient.rpc("spend_ai_credit", {
      p_reason: reason,
      p_project_id: projectId
    });
    if (error) {
      alert("AI kredit levonási hiba: " + error.message);
      throw error;
    }
    return data;
  },

  async getProjects() {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return data || [];
  },

  async saveProject(project) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    let data, error;
    try {
      const result = await supabaseClient
        .from("projects")
        .insert({
          user_id: user.id,
          name: project.name
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    } catch (err) {
      error = err;
    }

    if (error) {
      const message = friendlySupabaseError(error, "Projekt mentési hiba.");
      alert("Projekt mentési hiba: " + message);
      throw new Error(message);
    }

    return data;
  },


  async updateProject(projectId, name) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    const { data, error } = await supabaseClient
      .from("projects")
      .update({ name })
      .eq("id", projectId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      alert("Projekt módosítási hiba: " + error.message);
      throw error;
    }

    return data;
  },

  async deleteProject(projectId) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    const { data: entries, error: entryReadError } = await supabaseClient
      .from("entries")
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", user.id);
    if (entryReadError && !isMissingSupabaseObject(entryReadError)) {
      const message = friendlySupabaseError(entryReadError, "Projekt média beolvasási hiba.");
      alert("Projekt törlési hiba: " + message);
      throw new Error(message);
    }

    const videoPaths = new Set();
    (entries || []).forEach(entry => {
      collectVideoStoragePaths(entry.video_urls, videoPaths);
      collectVideoStoragePaths(entry.ai_json, videoPaths);
      collectVideoStoragePaths(entry.video_url, videoPaths);
    });

    try {
      const folder = `${user.id}/${projectId}`;
      const listed = await supabaseClient.storage.from("project-videos").list(folder, { limit: 1000 });
      if (!listed.error && Array.isArray(listed.data)) {
        listed.data.forEach(item => {
          if (item?.name) videoPaths.add(`${folder}/${item.name}`);
        });
      }

      const paths = [...videoPaths].filter(path => path && !String(path).startsWith("data:"));
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        const removed = await supabaseClient.storage.from("project-videos").remove(chunk);
        if (removed.error) throw removed.error;
      }
    } catch (storageError) {
      const message = friendlySupabaseError(storageError, "A projekt videóinak törlése nem sikerült.");
      throw new Error(message + " Ellenőrizd, hogy a V57 projekt-törlés SQL le van-e futtatva a Supabase SQL Editorban.");
    }

    await deleteProjectRows("report_approvals", [["project_id", projectId]]);
    await deleteProjectRows("public_reports", [["project_id", projectId], ["user_id", user.id]]);
    await deleteProjectRows("project_members", [["project_id", projectId], ["owner_user_id", user.id]]);
    await deleteProjectRows("project_materials", [["project_id", projectId], ["user_id", user.id]]);
    await deleteProjectRows("project_invoices", [["project_id", projectId], ["user_id", user.id]]);
    await deleteProjectRows("ai_photo_analyses", [["project_id", projectId], ["user_id", user.id]]);
    await deleteProjectRows("tasks", [["project_id", projectId], ["user_id", user.id]]);
    await deleteProjectRows("entries", [["project_id", projectId], ["user_id", user.id]]);

    const { error } = await supabaseClient
      .from("projects")
      .delete()
      .eq("id", projectId)
      .eq("user_id", user.id);

    if (error) {
      alert("Projekt törlési hiba: " + error.message);
      throw error;
    }

    return true;
  },

  createClientShareUrl(token) {
    const cleanToken = String(token || "").trim();
    try { if (cleanToken) localStorage.setItem("epitesnaplo_last_report_token", cleanToken); } catch (_) {}
    const current = new URL(window.location.href);
    const viewUrl = new URL("view.html", current.href);
    viewUrl.search = "";
    viewUrl.hash = "";
    viewUrl.searchParams.set("riport", cleanToken);
    return viewUrl.href;
  },



  async getEntries() {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabaseClient
      .from("entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return (data || []).map(entry => ({
      ...entry,
      projectId: entry.project_id,
      image: entry.image_url,
      images: Array.isArray(entry.image_urls) ? entry.image_urls : (entry.image_url ? [entry.image_url] : []),
      beforeImages: Array.isArray(entry.before_images_json) ? entry.before_images_json : (Array.isArray(entry.ai_json?.beforeImages) ? entry.ai_json.beforeImages : []),
      afterImages: Array.isArray(entry.after_images_json) ? entry.after_images_json : (Array.isArray(entry.ai_json?.afterImages) ? entry.ai_json.afterImages : []),
      generalImages: Array.isArray(entry.general_images_json) ? entry.general_images_json : (Array.isArray(entry.ai_json?.generalImages) ? entry.ai_json.generalImages : []),
      videos: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videos) ? entry.ai_json.videos : []),
      videoUrls: Array.isArray(entry.video_urls) ? entry.video_urls : (Array.isArray(entry.ai_json?.videoUrls) ? entry.ai_json.videoUrls : []),
      analysis: entry.ai_json || {
        level: entry.ai_level || "Alacsony",
        score: entry.ai_score || 0,
        title: entry.ai_title || "Elemzés",
        advice: Array.isArray(entry.ai_advice) ? entry.ai_advice : [],
        repairs: [],
        materials: []
      }
    }));
  },

  async saveEntry(entry) {
    const user = await this.getCurrentUser();
    if (!user) return entry;

    const images = Array.isArray(entry.images) ? entry.images : (entry.image ? [entry.image] : []);
    const videos = Array.isArray(entry.videos) ? entry.videos : (Array.isArray(entry.videoUrls) ? entry.videoUrls : []);
    const beforeImages = Array.isArray(entry.beforeImages) ? entry.beforeImages : [];
    const afterImages = Array.isArray(entry.afterImages) ? entry.afterImages : [];
    const generalImages = Array.isArray(entry.generalImages) ? entry.generalImages : images.filter(src => !beforeImages.includes(src) && !afterImages.includes(src));
    const aiJson = {
      ...(entry.analysis || {}),
      videos,
      videoUrls: videos,
      beforeImages,
      afterImages,
      generalImages,
      materials: Array.isArray(entry.materials) ? entry.materials : (entry.analysis?.materials || []),
      weatherJson: entry.weatherJson || null,
      gpsJson: entry.gpsJson || null
    };
    const payload = {
      user_id: user.id,
      project_id: entry.projectId,
      phase: entry.phase,
      status: entry.status,
      priority: entry.priority,
      responsible: entry.responsible,
      weather: entry.weather,
      note: entry.note,
      image_url: images[0] || null,
      ai_level: entry.analysis?.level || null,
      ai_score: entry.analysis?.score || null,
      ai_title: entry.analysis?.title || null,
      ai_advice: entry.analysis?.advice || []
    };

    // Újabb Supabase sémánál több fotó, videó és teljes AI objektum is mentődik.
    const proPayload = {
      ...payload,
      image_urls: images,
      video_urls: videos,
      ai_json: aiJson,
      before_images_json: beforeImages,
      after_images_json: afterImages,
      general_images_json: generalImages,
      materials_json: Array.isArray(entry.materials) ? entry.materials : [],
      weather_json: entry.weatherJson || null,
      gps_json: entry.gpsJson || null,
      location_address: entry.locationAddress || entry.gpsJson?.address || null
    };
    let result;
    try {
      result = await supabaseClient.from("entries").insert(proPayload).select().maybeSingle();

      // Ha valamelyik bővített oszlop még hiányzik, a videókat legalább ai_json-ban megtartjuk.
      if (result.error && /video_urls|before_images_json|after_images_json|general_images_json|materials_json|weather_json|gps_json|location_address|column|schema cache/i.test(String(result.error.message || ""))) {
        const aiOnlyPayload = { ...payload, ai_json: aiJson };
        result = await supabaseClient.from("entries").insert(aiOnlyPayload).select().maybeSingle();
      }

      // Ha még az ai_json oszlop sincs meg, akkor a napló menthető az alap mezőkkel.
      if (result.error && /image_urls|ai_json|column|schema cache/i.test(String(result.error.message || ""))) {
        result = await supabaseClient.from("entries").insert(payload).select().maybeSingle();
      }

      // RLS esetén előfordulhat, hogy az INSERT sikerülne, de a visszaolvasás (select) nem.
      // Ilyenkor újra mentünk select nélkül, és a felületet nem állítjuk meg fals hibával.
      if (result.error && /row-level security|permission denied|42501|select/i.test(String(result.error.message || ""))) {
        const plain = await supabaseClient.from("entries").insert(proPayload);
        if (!plain.error) {
          return { id: (crypto?.randomUUID?.() || String(Date.now())), ...entry, ...payload, image_urls: images, video_urls: videos, ai_json: aiJson };
        }
      }
    } catch (err) {
      result = { data: null, error: err };
    }

    if (result.error) {
      const message = friendlySupabaseError(result.error, "Napló mentési hiba.");
      alert("Napló mentési hiba: " + message);
      throw new Error(message);
    }

    return result.data || { id: (crypto?.randomUUID?.() || String(Date.now())), ...entry, ...payload, image_urls: images, video_urls: videos, ai_json: aiJson };
  },

  async updateEntry(entryId, patch = {}) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    let safePatch = {};
    ["note", "ai_json", "ai_level", "ai_score", "ai_title", "ai_advice", "image_url", "image_urls", "video_urls", "general_images_json"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(patch, key)) safePatch[key] = patch[key];
    });

    let { data, error } = await supabaseClient
      .from("entries")
      .update(safePatch)
      .eq("id", entryId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error && /video_urls|image_urls|general_images_json|column/i.test(String(error.message || "")) && safePatch.ai_json) {
      safePatch = {
        note: safePatch.note,
        ai_json: safePatch.ai_json,
        ai_level: safePatch.ai_level,
        ai_score: safePatch.ai_score,
        ai_title: safePatch.ai_title,
        ai_advice: safePatch.ai_advice,
        image_url: safePatch.image_url
      };
      Object.keys(safePatch).forEach((key) => safePatch[key] === undefined && delete safePatch[key]);
      const retry = await supabaseClient
        .from("entries")
        .update(safePatch)
        .eq("id", entryId)
        .eq("user_id", user.id)
        .select()
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      const message = friendlySupabaseError(error, "Napló frissítési hiba.");
      alert("Napló frissítési hiba: " + message);
      throw new Error(message);
    }
    return data;
  },

  async appendEntrySupplement(entryId, supplement, analysis = null, media = {}) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");
    const text = String(supplement || "").trim();
    if (!text) throw new Error("Nincs megadott kiegészítés.");

    let { data: current, error: readError } = await supabaseClient
      .from("entries")
      .select("id,note,ai_json,ai_level,ai_score,ai_title,ai_advice,image_url,image_urls,video_urls,general_images_json")
      .eq("id", entryId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (readError && /video_urls|image_urls|general_images_json|column/i.test(String(readError.message || ""))) {
      const retry = await supabaseClient
        .from("entries")
        .select("id,note,ai_json,ai_level,ai_score,ai_title,ai_advice,image_url")
        .eq("id", entryId)
        .eq("user_id", user.id)
        .maybeSingle();
      current = retry.data;
      readError = retry.error;
    }

    if (readError || !current) {
      const message = friendlySupabaseError(readError, "A bejegyzés nem található vagy nem módosítható.");
      alert("Kiegészítés hiba: " + message);
      throw new Error(message);
    }

    const stamp = new Date().toLocaleString("hu-HU");
    const note = `${current.note || ""}\n\nKiegészítés (${stamp}):\n${text}`.trim();
    const existingImages = Array.isArray(current.image_urls) ? current.image_urls : (current.image_url ? [current.image_url] : []);
    const existingGeneral = Array.isArray(current.general_images_json) ? current.general_images_json : [];
    const existingVideos = Array.isArray(current.video_urls) ? current.video_urls : (Array.isArray(current.ai_json?.videos) ? current.ai_json.videos : []);
    const addedImages = Array.isArray(media.images) ? media.images.filter(Boolean) : [];
    const addedVideos = Array.isArray(media.videos) ? media.videos.filter(Boolean) : [];
    const imageUrls = [...existingImages, ...addedImages];
    const generalImages = [...existingGeneral, ...addedImages];
    const videoUrls = [...existingVideos, ...addedVideos];
    const aiJson = {
      ...(current.ai_json || {}),
      ...(analysis || {}),
      generalImages,
      videos: videoUrls,
      videoUrls,
      supplements: [
        ...((current.ai_json && Array.isArray(current.ai_json.supplements)) ? current.ai_json.supplements : []),
        { text, images: addedImages, videos: addedVideos, created_at: new Date().toISOString(), analysis: analysis || null }
      ]
    };

    return this.updateEntry(entryId, {
      note,
      ai_json: aiJson,
      image_url: imageUrls[0] || null,
      image_urls: imageUrls,
      video_urls: videoUrls,
      general_images_json: generalImages,
      ai_level: analysis?.level || current.ai_level || aiJson.level || null,
      ai_score: analysis?.score || current.ai_score || aiJson.score || null,
      ai_title: analysis?.title || current.ai_title || aiJson.title || null,
      ai_advice: analysis?.advice || current.ai_advice || aiJson.advice || []
    });
  },

  async getTasks() {
    const user = await this.getCurrentUser();
    if (!user) return [];

    const { data } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    return data || [];
  },

  async saveTask(task) {
    const user = await this.getCurrentUser();
    if (!user) return task;

    const { data, error } = await supabaseClient
      .from("tasks")
      .insert({
        user_id: user.id,
        project_id: task.projectId,
        title: task.title,
        owner: task.owner,
        deadline: task.deadline || null,
        priority: task.priority,
        done: task.done || false
      })
      .select()
      .single();

    if (error) {
      alert("Hibajegy mentési hiba: " + error.message);
      return task;
    }

    return data;
  },


  async getAdminUserProjects(userId) {
    const current = await this.getCurrentUser();
    if (!current || !(await this.isCurrentUserAdmin())) return [];

    const { data, error } = await supabaseClient
      .from("projects")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return [];
    }

    return data || [];
  },

  async getAdminUserEntries(userId) {
    const current = await this.getCurrentUser();
    if (!current || !(await this.isCurrentUserAdmin())) return [];

    const { data, error } = await supabaseClient
      .from("entries")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return [];
    }

    return (data || []).map(entry => ({
      ...entry,
      projectId: entry.project_id,
      image: entry.image_url,
      analysis: {
        level: entry.ai_level || "Alacsony",
        score: entry.ai_score || 0,
        title: entry.ai_title || "Elemzés",
        advice: Array.isArray(entry.ai_advice) ? entry.ai_advice : [],
        repairs: [],
        materials: []
      }
    }));
  },

  async getAdminUserTasks(userId) {
    const current = await this.getCurrentUser();
    if (!current || !(await this.isCurrentUserAdmin())) return [];

    const { data, error } = await supabaseClient
      .from("tasks")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return [];
    }

    return (data || []).map(task => ({
      ...task,
      projectId: task.project_id
    }));
  },


  sanitizeReportHtml(html) {
    const input = String(html || "");
    if (!input.trim()) return "";
    const allowedTags = new Set([
      "A", "B", "BR", "DIV", "EM", "H1", "H2", "H3", "H4", "HR", "I", "IMG",
      "FIGURE", "LI", "OL", "P", "SECTION", "SMALL", "SPAN", "STRONG", "TABLE", "TBODY", "TD",
      "TH", "THEAD", "TR", "U", "UL", "VIDEO"
    ]);
    const allowedAttrs = {
      A: new Set(["href", "target", "rel", "class"]),
      IMG: new Set(["src", "alt", "class", "data-media-path", "data-image-path", "data-path", "data-src", "data-full-src", "loading", "decoding", "crossorigin"]),
      VIDEO: new Set(["src", "controls", "playsinline", "preload", "class", "data-video-path", "data-media-path", "data-path"]),
      DIV: new Set(["class"]),
      SPAN: new Set(["class"]),
      P: new Set(["class"]),
      SECTION: new Set(["class"]),
      TABLE: new Set(["class"]),
      FIGURE: new Set(["class"]),
      UL: new Set(["class"]),
      OL: new Set(["class"]),
      LI: new Set(["class"])
    };
    const template = document.createElement("template");
    let htmlInput = input;
    if (/<html[\s>]/i.test(input) || /<body[\s>]/i.test(input)) {
      try {
        const parsed = new DOMParser().parseFromString(input, "text/html");
        htmlInput = parsed.body?.innerHTML || input;
      } catch (_) {}
    }
    template.innerHTML = htmlInput;
    const cleanUrl = (value, image = false) => {
      const v = String(value || "").trim();
      if (!v) return "";
      const lower = v.toLowerCase();
      if (lower.startsWith("javascript:") || lower.startsWith("vbscript:")) return "";
      if (lower.startsWith("data:image/") || lower.startsWith("data:video/")) return v;
      if (image && lower.startsWith("data:image/")) return v;
      if (lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("./") || lower.startsWith("/")) return v;
      return "";
    };
    const walk = (node) => {
      [...node.children].forEach((el) => {
        if (!allowedTags.has(el.tagName)) {
          if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) {
            el.remove();
          } else {
            el.replaceWith(document.createTextNode(el.textContent || ""));
          }
          return;
        }
        [...el.attributes].forEach((attr) => {
          const name = attr.name.toLowerCase();
          const allowed = allowedAttrs[el.tagName]?.has(name);
          if (!allowed || name.startsWith("on") || name === "style") {
            el.removeAttribute(attr.name);
            return;
          }
          if (name === "href") {
            const href = cleanUrl(attr.value);
            if (!href) el.removeAttribute(attr.name);
            else {
              el.setAttribute("href", href);
              el.setAttribute("rel", "noopener noreferrer");
            }
          }
          if (el.tagName === "VIDEO" && ["controls", "playsinline"].includes(name)) {
            el.setAttribute(name, "");
          }
          if (el.tagName === "VIDEO" && name === "preload" && !["none", "metadata", "auto"].includes(attr.value)) {
            el.setAttribute("preload", "metadata");
          }
          if (["data-video-path","data-media-path","data-image-path","data-path","data-src","data-full-src"].includes(name) && /(^|\/)\.\.(\/|$)/.test(attr.value)) {
            el.removeAttribute(attr.name);
          }
          if (name === "src") {
            const src = cleanUrl(attr.value, el.tagName === "IMG");
            if (!src) el.removeAttribute(attr.name);
            else el.setAttribute("src", src);
          }
        });
        walk(el);
      });
    };
    walk(template.content);
    return template.innerHTML;
  },

  async createPublicReport({ projectId, projectName, reportHtml, reportText }) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    const token =
      crypto.randomUUID().replaceAll("-", "") +
      Math.random().toString(36).slice(2, 10);

    let result = await supabaseClient
      .from("public_reports")
      .insert({
        token,
        user_id: user.id,
        project_id: projectId,
        project_name: projectName,
        report_html: this.sanitizeReportHtml(reportHtml),
        report_text: reportText,
        status: "created",
        view_count: 0,
        is_active: true,
        expires_at: null
      })
      .select()
      .single();

    if (result.error && /status|view_count|column/i.test(String(result.error.message || ""))) {
      result = await supabaseClient
        .from("public_reports")
        .insert({
          token,
          user_id: user.id,
          project_id: projectId,
          project_name: projectName,
          report_html: this.sanitizeReportHtml(reportHtml),
          report_text: reportText,
          is_active: true,
          expires_at: null
        })
        .select()
        .single();
    }

    if (result.error) {
      alert("Ügyfél link létrehozási hiba: " + result.error.message);
      throw result.error;
    }

    try {
      await supabaseClient.from("notifications").insert({
        user_id: user.id,
        type: "client_link",
        title: "Ügyfél link létrehozva",
        message: projectName || "Új ügyfélriport készült."
      });
    } catch (_) {}

    return result.data;
  },

  async getPublicReport(token) {
    const { data, error } = await supabaseClient.rpc("get_public_report_by_token", {
      p_token: token
    });

    if (error) {
      console.warn("Publikus riport hiba:", error);
      return null;
    }

    const report = Array.isArray(data) ? data[0] : data;
    if (report?.report_html) report.report_html = this.sanitizeReportHtml(report.report_html);
    return report || null;
  },

  async getPublicReportMediaUrls(token, paths, all = false) {
    const cleanPaths = [...new Set((paths || []).map(p => String(p || "").trim()).filter(Boolean))];
    if (!token || (!cleanPaths.length && !all)) return all ? [] : {};

    const response = await fetch(`${window.EPITESNAPLO_CONFIG.supabaseUrl}/functions/v1/public-report-media`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, paths: cleanPaths, all })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.error) {
      console.warn("Publikus riport média hiba:", result.error || response.statusText);
      return all ? [] : {};
    }
    return all ? (result.media || []) : (result.urls || {});
  },

  async getPublicReportAllMedia(token) {
    return await this.getPublicReportMediaUrls(token, [], true);
  },

  async hydratePublicReportMedia(token, root = document) {
    const medias = [...root.querySelectorAll("video[data-video-path], img[data-media-path], img[data-image-path], img[data-path]")];
    const paths = medias.map(el => el.getAttribute("data-video-path") || el.getAttribute("data-media-path") || el.getAttribute("data-image-path") || el.getAttribute("data-path")).filter(Boolean);
    if (!paths.length) return;
    const urls = await this.getPublicReportMediaUrls(token, paths);
    medias.forEach(el => {
      const path = el.getAttribute("data-video-path") || el.getAttribute("data-media-path") || el.getAttribute("data-image-path") || el.getAttribute("data-path");
      const url = urls[path];
      if (!url) return;
      el.src = url;
      if (el.tagName === "VIDEO") {
        el.controls = true;
        el.playsInline = true;
        el.preload = "metadata";
        el.muted = false;
        el.volume = 1;
      } else {
        el.loading = "lazy";
        el.decoding = "async";
      }
      const tile = el.closest(".reportMediaTile");
      const link = tile?.querySelector?.(".reportMediaOpen");
      if (link) {
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
      }
    });
  },

  async markPublicReportOpened(token) {
    if (!token) return false;
    try {
      const { data, error } = await supabaseClient.rpc("mark_public_report_opened", {
        p_token: token,
        p_user_agent: navigator.userAgent || ""
      });
      if (error) throw error;
      return data === true;
    } catch (err) {
      console.warn("Riport megnyitás követése nem sikerült:", err);
      return false;
    }
  },


  async saveSupportMessage({ subject, message }) {
    const user = await this.getCurrentUser();
    if (!user) throw new Error("Nincs bejelentkezve.");

    const name = user.user_metadata?.full_name || user.email || "Felhasználó";
    const email = user.email || "";

    const { data, error } = await supabaseClient
      .from("support_messages")
      .insert({
        user_id: user.id,
        email,
        name,
        subject: subject || "Hibabejelentés",
        message,
        status: "new"
      })
      .select()
      .single();

    if (error) {
      alert("Üzenet mentési hiba: " + error.message);
      throw error;
    }

    try {
      await supabaseClient.from("notifications").insert({
        user_id: user.id,
        type: "support_message",
        title: "Üzenet elküldve az adminnak",
        message: subject || "Hibabejelentés"
      });
    } catch (_) {}

    try {
      await supabaseClient.functions.invoke("notify-admin", {
        body: { subject, message, name, email }
      });
    } catch (err) {
      console.warn("Email értesítés nem ment ki, de az üzenet mentve van:", err);
    }

    return data;
  },

  async analyzePhotoWithAI(payload) {
    const session = await this.getSession();
    if (!session?.access_token) return { ok: false, error: "Nincs bejelentkezve." };
    const { data, error } = await supabaseClient.functions.invoke("ai-vision-analyze", { body: payload });
    if (error) {
      console.warn("AI Vision Edge Function nem elérhető:", error.message || error);
      return { ok: false, error: error.message || String(error) };
    }
    return data;
  },

  async savePhotoAnalyses(projectId, analyses) {
    const user = await this.getCurrentUser();
    if (!user || !Array.isArray(analyses) || !analyses.length) return false;
    const rows = analyses.map(item => ({
      user_id: user.id,
      project_id: projectId,
      entry_id: item.entry_id || null,
      analysis: item.analysis || {},
      risk_level: item.analysis?.level || null,
      confidence: item.analysis?.confidence || null,
      source: item.analysis?.source || "AI képfelismerés"
    }));
    const { error } = await supabaseClient.from("ai_photo_analyses").insert(rows);
    if (error) console.warn("AI fotóelemzés mentési hiba:", error.message || error);
    return !error;
  },

  async getAdminSupportMessages() {
    const user = await this.getCurrentUser();
    if (!user || !(await this.isCurrentUserAdmin())) return [];

    let result = await supabaseClient
      .from("admin_support_messages_overview")
      .select("*")
      .order("created_at", { ascending: false });

    if (result.error) {
      result = await supabaseClient
        .from("support_messages")
        .select("*")
        .order("created_at", { ascending: false });
    }

    if (result.error) {
      console.warn("Admin üzenetlista hiba:", result.error);
      return [];
    }

    return result.data || [];
  },

  async markSupportMessageRead(messageId) {
    const user = await this.getCurrentUser();
    if (!user || !(await this.isCurrentUserAdmin())) return false;
    const { error } = await supabaseClient
      .from("support_messages")
      .update({ status: "read" })
      .eq("id", messageId);
    if (error) console.warn(error);
    return !error;
  },

  async deleteSupportMessage(messageId) {
    const user = await this.getCurrentUser();
    if (!user || !(await this.isCurrentUserAdmin())) throw new Error("Nincs admin jogosultság.");

    const rpcResult = await supabaseClient.rpc("admin_delete_support_message", { p_message_id: messageId });
    if (!rpcResult.error) return true;

    const { error } = await supabaseClient
      .from("support_messages")
      .delete()
      .eq("id", messageId);
    if (error) { console.warn("Admin üzenet törlési hiba:", error); throw error; }
    return true;
  },

  async getNotifications() {
    const user = await this.getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabaseClient
      .from("notifications")
      .select("*")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.warn("Értesítés betöltési hiba:", error);
      return [];
    }
    return data || [];
  },

  async markNotificationRead(notificationId) {
    const user = await this.getCurrentUser();
    if (!user || !notificationId) return false;
    const { error } = await supabaseClient
      .from("notifications")
      .update({ read: true })
      .eq("id", notificationId);
    if (error) { console.warn("Értesítés olvasottra állítás hiba:", error); return false; }
    return true;
  },

  async deleteNotification(notificationId) {
    const user = await this.getCurrentUser();
    if (!user || !notificationId) return false;
    const { error } = await supabaseClient
      .from("notifications")
      .delete()
      .eq("id", notificationId);
    if (error) { console.warn("Értesítés törlési hiba:", error); throw error; }
    return true;
  },

  async clearMyNotifications() {
    const user = await this.getCurrentUser();
    if (!user) return false;
    const { error } = await supabaseClient
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (error) { console.warn("Értesítések törlési hiba:", error); throw error; }
    return true;
  },
  async sendClientNotification({ email, phone, projectName, link, message }) {
    const session = await this.getSession();
    if (!session?.access_token) throw new Error("Nincs bejelentkezve.");

    // Edge function opcionális: ha később be van kötve Resend/Twilio, automatikusan innen küld.
    const { data, error } = await supabaseClient.functions.invoke("notify-client", {
      body: { email, phone, projectName, link, message }
    });

    if (error) {
      console.warn("Ügyfél értesítő edge function még nincs bekötve:", error);
      return { ok: false, fallback: true, error: error.message };
    }

    return data || { ok: true };
  },


  async deleteAccount({ confirmText, reason }) {
    const session = await this.getSession();
    if (!session?.access_token) throw new Error("Nincs bejelentkezve.");
    if (confirmText !== "TÖRLÉS") throw new Error("Hibás megerősítő szöveg.");

    const { data, error } = await supabaseClient.functions.invoke("delete-account", {
      body: { confirmText, reason: reason || "Felhasználói fióktörlés" }
    });

    if (error) {
      console.warn("Fióktörlés Edge Function hiba:", error);
      return { ok: false, error: error.message || String(error) };
    }

    await supabaseClient.auth.signOut();
    return data || { ok: true };
  },

  async adminSetUserPlan(userId, plan, status = "active", days = 30) {
    const user = await this.getCurrentUser();
    const profile = user ? await this.getProfile() : null;
    if (!user || !(profile?.is_admin || user.email === window.EPITESNAPLO_CONFIG.adminEmail)) throw new Error("Nincs admin jogosultság.");
    const { data, error } = await supabaseClient.rpc("admin_set_user_plan", { p_user_id: userId, p_plan: plan, p_status: status, p_days: days });
    if (error) { alert("Csomag állítási hiba: " + error.message); throw error; }
    return data;
  },

  async adminGrantAiCredits(userId, credits, reason = "admin_manual_grant") {
    const user = await this.getCurrentUser();
    const profile = user ? await this.getProfile() : null;
    if (!user || !(profile?.is_admin || user.email === window.EPITESNAPLO_CONFIG.adminEmail)) throw new Error("Nincs admin jogosultság.");
    const { data, error } = await supabaseClient.rpc("admin_grant_ai_credits", { p_user_id: userId, p_credits: credits, p_reason: reason });
    if (error) { alert("AI kredit jóváírási hiba: " + error.message); throw error; }
    return data;
  },

  async adminSetUserAdmin(userId, isAdmin) {
    const user = await this.getCurrentUser();
    const profile = user ? await this.getProfile() : null;
    if (!user || !(profile?.is_admin || user.email === window.EPITESNAPLO_CONFIG.adminEmail)) throw new Error("Nincs admin jogosultság.");
    const { data, error } = await supabaseClient.rpc("admin_set_user_admin", { p_user_id: userId, p_is_admin: !!isAdmin });
    if (error) { alert("Admin jogosultság állítási hiba: " + error.message); throw error; }
    return data;
  },

  async getAdminUsers() {
    const user = await this.getCurrentUser();
    if (!user || !(await this.isCurrentUserAdmin())) return [];

    const { data, error } = await supabaseClient
      .from("admin_users_overview")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return [];
    }

    return data || [];
  },

  async getAdminPayments() {
    const user = await this.getCurrentUser();
    if (!user || !(await this.isCurrentUserAdmin())) return [];

    const { data, error } = await supabaseClient
      .from("admin_payments_overview")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.warn(error);
      return [];
    }

    return data || [];
  }
};

// ===== v25 KÖVETKEZŐ SZINT PRO API bővítések =====
(function(){
  const api = window.EpitesNaploAPI;
  const db = window.supabaseDirect;
  if(!api || !db) return;

  api.activateProViaEdge = async function(orderId, requestedPlan = null) {
    const session = await this.getSession();
    if (!session?.access_token) {
      alert('Fizetés előtt jelentkezz be.');
      return null;
    }
    const response = await fetch(`${window.EPITESNAPLO_CONFIG.supabaseUrl}/functions/v1/paypal-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session.access_token}` },
      body: JSON.stringify({ orderId, requestedPlan })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      alert('Pro aktiválási hiba: ' + (result.error || 'ismeretlen hiba'));
      return null;
    }
    alert('Sikeres fizetés! A csomag automatikusan aktiválva.');
    return result.subscription || { plan: result.plan || requestedPlan || 'pro', status: 'active' };
  };

  api.generateAiDailyReport = async function(payload){
    const session = await this.getSession();
    if(!session?.access_token) throw new Error('Nincs bejelentkezve.');
    const { data, error } = await db.functions.invoke('ai-report-generate', { body: payload });
    if(error) throw error;
    return data || { ok:false };
  };

  api.getReportApprovals = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user) return [];
    const { data, error } = await db.from('report_approvals').select('*').eq('project_id', projectId).order('approved_at', { ascending:false });
    if(error){ console.warn('Jóváhagyás lista hiba:', error.message); return []; }
    return data || [];
  };

  api.approvePublicReport = async function(token, payload = {}){
    const decision = String(payload.decision || 'accepted').slice(0, 40);
    const message = String(payload.message || '').slice(0, 1000);
    let result = await db.rpc('approve_public_report_v71', {
      p_token: token,
      p_client_name: payload.name || '',
      p_client_email: payload.email || '',
      p_decision: decision,
      p_message: message,
      p_user_agent: navigator.userAgent || '',
      p_approved_report_html: payload.reportHtml || '',
      p_approved_report_text: payload.reportText || ''
    });
    if(result.error && /function .* does not exist|schema cache/i.test(String(result.error.message || ''))){
      result = await db.rpc('approve_public_report_v33', {
        p_token: token,
        p_client_name: payload.name || '',
        p_client_email: payload.email || '',
        p_decision: decision,
        p_message: message,
        p_user_agent: navigator.userAgent || ''
      });
    }
    if(result.error && /function .* does not exist|schema cache/i.test(String(result.error.message || ''))){
      result = await db.rpc('approve_public_report_by_token', {
        p_token: token,
        p_client_name: payload.name || '',
        p_client_email: payload.email || '',
        p_user_agent: navigator.userAgent || ''
      });
    }
    if(result.error) throw result.error;
    // V90: az ügyfél kérdését/megjegyzését biztosan mentjük.
    // A régi megoldás anon felhasználónál RLS miatt nem mindig tudott update-et futtatni,
    // ezért először sima update-et próbálunk, majd security definer RPC-vel javítjuk a legutóbbi jóváhagyást.
    try {
      const clientComment = String(payload.clientComment || payload.message || '').slice(0, 2500);
      const approvalId = result?.data?.id || result?.data?.approval_id || result?.data?.approval?.id || null;
      const approvedHtml = String(payload.reportHtml || '').slice(0, 900000);
      const approvedText = String(payload.reportText || '').slice(0, 120000);
      if (clientComment) {
        if (approvalId) {
          await db.from('report_approvals')
            .update({ client_comment: clientComment, message: clientComment, approved_report_html: approvedHtml, approved_report_text: approvedText })
            .eq('id', approvalId);
        }
        await db.rpc('patch_report_approval_comment_v90', {
          p_token: token,
          p_client_comment: clientComment,
          p_approved_report_html: approvedHtml,
          p_approved_report_text: approvedText
        });
      }
    } catch (patchError) {
      console.warn('Ügyfél kérdés utólagos mentése nem sikerült:', patchError?.message || patchError);
    }
    return result.data;
  };

  api.getApprovedReportHtml = async function(approvalId){
    const user = await this.getCurrentUser();
    if(!user || !approvalId) return null;
    const { data, error } = await db.from('report_approvals').select('*').eq('id', approvalId).single();
    if(error){ console.warn('Jóváhagyott riport lekérési hiba:', error.message); return null; }
    return data;
  };

  api.saveProjectMember = async function(projectId, member = {}){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    const payload = {
      project_id: projectId,
      owner_user_id: user.id,
      email: String(member.email || '').trim(),
      role: String(member.role || 'worker'),
      status: 'invited'
    };
    const { data, error } = await db.from('project_members').insert(payload).select().single();
    if(error) throw error;
    return data;
  };

  api.getProjectMembers = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user) return [];
    const { data, error } = await db.from('project_members').select('*').eq('project_id', projectId).order('created_at', { ascending:false });
    if(error){ console.warn('Szerepkor lista hiba:', error.message); return []; }
    return data || [];
  };
})();

// ===== V76: mindig elérhető riport dokumentumkezelő + cím mentés stabilizálás =====
(function(){
  const api = window.EpitesNaploAPI;
  if(!api || !window.supabaseDirect) return;
  const db = window.supabaseDirect;

  api.saveReportDocument = async function(payload = {}){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    const row = {
      project_id: payload.projectId,
      approval_id: payload.approvalId || null,
      owner_user_id: user.id,
      title: String(payload.title || 'Építési napló riport').slice(0, 220),
      document_type: String(payload.type || 'approved_report').slice(0, 80),
      html_content: String(payload.html || ''),
      text_content: String(payload.text || '').slice(0, 20000),
      meta_json: payload.meta || {}
    };
    const { data, error } = await db.from('report_documents').insert(row).select().single();
    if(error) throw error;
    return data;
  };

  api.listReportDocuments = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user || !projectId) return [];
    const { data, error } = await db.from('report_documents')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending:false });
    if(error){ console.warn('Riport dokumentum lista hiba:', error.message); return []; }
    return data || [];
  };

  api.deleteReportDocument = async function(documentId){
    const user = await this.getCurrentUser();
    if(!user || !documentId) throw new Error('Nincs bejelentkezve vagy hiányzó dokumentum azonosító.');
    const { error } = await db.from('report_documents').delete().eq('id', documentId);
    if(error) throw error;
    return true;
  };

  const oldSaveEntry = api.saveEntry?.bind(api);
  if(oldSaveEntry){
    api.saveEntry = async function(entry = {}){
      const address = entry.locationAddress || entry.gpsJson?.address || '';
      if(address){
        entry.locationAddress = address;
        entry.gpsJson = { ...(entry.gpsJson || {}), address, text: entry.gpsJson?.text || address };
      }
      return oldSaveEntry(entry);
    };
  }
})();

// ===== V86: pontos riport dokumentum + bejegyzés/projekt törlés tisztítás =====
(function(){
  const api = window.EpitesNaploAPI;
  const db = window.supabaseDirect;
  if(!api || !db || api.__v86CleanApi) return;
  api.__v86CleanApi = true;

  const missing = (e)=>/does not exist|schema cache|not found|relation .* does not exist|column .* does not exist/i.test(String(e?.message || e || ''));
  async function currentUser(){ const u = await api.getCurrentUser(); if(!u) throw new Error('Nincs bejelentkezve.'); return u; }
  async function safeDelete(table, filters){
    try{
      let q = db.from(table).delete();
      (filters || []).forEach(([k,v]) => { q = q.eq(k,v); });
      const { error } = await q;
      if(error && !missing(error)) throw error;
    }catch(e){ if(!missing(e)) throw e; }
  }

  api.getReportDocumentByApproval = async function(approvalId){
    const user = await this.getCurrentUser();
    if(!user || !approvalId) return null;
    try{
      const { data, error } = await db.from('report_documents')
        .select('*')
        .eq('approval_id', approvalId)
        .order('created_at', { ascending:false })
        .limit(6);
      if(error){ if(!missing(error)) console.warn('Riport dokumentum approval lekérés hiba:', error.message); return null; }
      return (data || []).find(d => String(d.html_content || '').length > 500) || (data || [])[0] || null;
    }catch(e){ console.warn('Riport dokumentum approval lekérés hiba:', e.message || e); return null; }
  };

  api.deleteEntry = async function(entryId){
    const user = await currentUser();
    if(!entryId) throw new Error('Hiányzó bejegyzés azonosító.');
    // A fotók jellemzően adatbázisban/base64-ben vannak, ezért a DB sor törlése ténylegesen felszabadítja a helyet.
    await safeDelete('project_materials', [['entry_id', entryId], ['user_id', user.id]]);
    await safeDelete('project_invoices', [['entry_id', entryId], ['user_id', user.id]]);
    await safeDelete('ai_photo_analyses', [['entry_id', entryId], ['user_id', user.id]]);
    await safeDelete('tasks', [['entry_id', entryId], ['user_id', user.id]]);
    await safeDelete('diary_entries', [['id', entryId], ['user_id', user.id]]);
    await safeDelete('entries', [['id', entryId], ['user_id', user.id]]);
    return true;
  };

  const oldDeleteProject = api.deleteProject?.bind(api);
  api.deleteProject = async function(projectId){
    const user = await currentUser();
    if(!projectId) throw new Error('Hiányzó projekt azonosító.');
    // Előbb minden kapcsolódó sort törlünk, hogy ne maradjon felesleges Supabase adat.
    await safeDelete('report_documents', [['project_id', projectId]]);
    await safeDelete('report_approvals', [['project_id', projectId]]);
    await safeDelete('public_reports', [['project_id', projectId]]);
    await safeDelete('project_members', [['project_id', projectId]]);
    await safeDelete('project_materials', [['project_id', projectId]]);
    await safeDelete('project_invoices', [['project_id', projectId]]);
    await safeDelete('ai_photo_analyses', [['project_id', projectId]]);
    await safeDelete('tasks', [['project_id', projectId]]);
    await safeDelete('diary_entries', [['project_id', projectId]]);
    await safeDelete('entries', [['project_id', projectId]]);
    try{
      const folder = `${user.id}/${projectId}`;
      const listed = await db.storage.from('project-videos').list(folder, { limit:1000 });
      if(!listed.error && Array.isArray(listed.data) && listed.data.length){
        const paths = listed.data.map(x => x?.name ? `${folder}/${x.name}` : '').filter(Boolean);
        for(let i=0;i<paths.length;i+=100){ await db.storage.from('project-videos').remove(paths.slice(i,i+100)); }
      }
    }catch(e){ console.warn('Projekt storage tisztítás figyelmeztetés:', e.message || e); }
    try{
      const { error } = await db.from('projects').delete().eq('id', projectId).eq('user_id', user.id);
      if(error && !missing(error)) throw error;
    }catch(e){
      if(oldDeleteProject) return oldDeleteProject(projectId);
      throw e;
    }
    return true;
  };
})();

// ===== V110: gyors projekt törlés + Supabase takarítás RPC elsőként =====
(function(){
  const api = window.EpitesNaploAPI;
  const db = window.supabaseDirect;
  if(!api || !db || api.__v110DeleteFix) return;
  api.__v110DeleteFix = true;
  const oldDeleteProject = api.deleteProject?.bind(api);
  const missing = e => /does not exist|schema cache|not found|relation .* does not exist|function .* does not exist|column .* does not exist|42P01|42703/i.test(String(e?.message || e || ''));
  async function safeDelete(table, filters){
    try{
      let q = db.from(table).delete();
      (filters || []).forEach(([k,v]) => { q = q.eq(k,v); });
      const { error } = await q;
      if(error && !missing(error)) throw error;
    }catch(e){ if(!missing(e)) throw e; }
  }
  api.deleteProject = async function(projectId){
    const user = await this.getCurrentUser();
    if(!user) throw new Error('Nincs bejelentkezve.');
    if(!projectId) throw new Error('Hiányzó projekt azonosító.');

    // 1) Legjobb megoldás: SQL-ben futó takarító RPC, mert nem timeoutol könnyen.
    try{
      const { data, error } = await db.rpc('delete_project_full_v110', { p_project_id: projectId });
      if(!error && data !== false) return true;
      if(error && !missing(error)) throw error;
    }catch(e){
      if(!missing(e)) console.warn('V110 RPC projekt törlés nem sikerült, kliens oldali takarítás indul:', e.message || e);
    }

    // 2) Fallback: több kisebb, párhuzamos törlés. Ha egy opcionális tábla nincs, nem áll meg.
    const deletes = [
      ['report_documents', [['project_id', projectId]]],
      ['report_approvals', [['project_id', projectId]]],
      ['public_reports', [['project_id', projectId]]],
      ['notifications', [['project_id', projectId]]],
      ['media_files', [['project_id', projectId]]],
      ['project_members', [['project_id', projectId]]],
      ['project_materials', [['project_id', projectId]]],
      ['project_invoices', [['project_id', projectId]]],
      ['ai_photo_analyses', [['project_id', projectId]]],
      ['tasks', [['project_id', projectId]]],
      ['diary_entries', [['project_id', projectId]]],
      ['entries', [['project_id', projectId]]]
    ];
    await Promise.allSettled(deletes.map(([t,f]) => safeDelete(t,f)));

    try{
      const folder = `${user.id}/${projectId}`;
      for(const bucket of ['project-videos','project-media','media-files','report-media']){
        try{
          const listed = await db.storage.from(bucket).list(folder, { limit:1000 });
          if(!listed.error && Array.isArray(listed.data) && listed.data.length){
            const paths = listed.data.map(x => x?.name ? `${folder}/${x.name}` : '').filter(Boolean);
            for(let i=0;i<paths.length;i+=100){ await db.storage.from(bucket).remove(paths.slice(i,i+100)); }
          }
        }catch(_){ }
      }
    }catch(e){ console.warn('Storage takarítás figyelmeztetés:', e.message || e); }

    const { error } = await db.from('projects').delete().eq('id', projectId).eq('user_id', user.id);
    if(error && !missing(error)){
      if(oldDeleteProject) return oldDeleteProject(projectId);
      throw error;
    }
    return true;
  };
})();

// ===== V117: riport képek lekérése + report_events takarítás + teljes projekt törlés bővítés =====
(function(){
  const api = window.EpitesNaploAPI;
  const db = window.supabaseDirect;
  if(!api || !db || api.__v117ReportMediaCleanup) return;
  api.__v117ReportMediaCleanup = true;
  const missing = e => /does not exist|schema cache|not found|relation .* does not exist|function .* does not exist|column .* does not exist|42P01|42703/i.test(String(e?.message || e || ''));
  const uniq = arr => [...new Set((arr||[]).map(x=>String(x||'').trim()).filter(Boolean))];
  function collect(value,out){
    if(!value) return;
    if(Array.isArray(value)){ value.forEach(v=>collect(v,out)); return; }
    if(typeof value === 'object'){
      ['url','src','href','path','image','image_url','publicUrl','public_url','signedUrl','signed_url','storage_path','file_path','full_path'].forEach(k=>collect(value[k],out));
      ['images','imageUrls','image_urls','photos','files','media','beforeImages','afterImages','generalImages','before_images_json','after_images_json','general_images_json'].forEach(k=>collect(value[k],out));
      return;
    }
    const s=String(value||'').trim();
    if(/^data:image\//i.test(s) || /^https?:\/\//i.test(s) || /\.(jpe?g|png|webp|gif|avif)(\?|#|$)/i.test(s)) out.push(s);
  }
  async function signedMaybe(bucket,path){
    if(!bucket || !path || /^https?:|^data:image\//i.test(path)) return path;
    try{ const r=await db.storage.from(bucket).createSignedUrl(path, 60*60*24*7); if(r.data?.signedUrl) return r.data.signedUrl; }catch(_){ }
    try{ const r=db.storage.from(bucket).getPublicUrl(path); if(r.data?.publicUrl) return r.data.publicUrl; }catch(_){ }
    return '';
  }
  api.getProjectMediaForReport = async function(projectId){
    const user = await this.getCurrentUser?.();
    if(!user || !projectId) return [];
    const out=[];
    try{
      const { data, error } = await db.from('diary_entries').select('*').eq('project_id', projectId).eq('user_id', user.id).order('created_at',{ascending:true});
      if(!error) (data||[]).forEach(r=>collect(r,out));
    }catch(e){ if(!missing(e)) console.warn('diary_entries média hiba',e); }
    try{
      const { data, error } = await db.from('entries').select('*').eq('project_id', projectId).eq('user_id', user.id).order('created_at',{ascending:true});
      if(!error) (data||[]).forEach(r=>collect(r,out));
    }catch(e){ if(!missing(e)) console.warn('entries média hiba',e); }
    try{
      const { data, error } = await db.from('media_files').select('*').eq('project_id', projectId);
      if(!error){
        for(const r of (data||[])){
          collect(r,out);
          const bucket = r.bucket || r.bucket_id || r.storage_bucket || r.bucket_name || 'project-media';
          const p = r.path || r.storage_path || r.file_path || r.full_path || '';
          const u = await signedMaybe(bucket,p); if(u) out.push(u);
        }
      }
    }catch(e){ if(!missing(e)) console.warn('media_files média hiba',e); }
    return uniq(out).filter(x=>!/(\.mp4|\.mov|\.webm)(\?|#|$)/i.test(x));
  };

  api.cleanupReportEvents = async function(days=14){
    try{ const { error } = await db.rpc('cleanup_report_events_v117', { p_days: days }); if(error && !missing(error)) throw error; return true; }
    catch(e){
      if(!missing(e)) console.warn('report_events takarítás RPC hiba:', e.message||e);
      try{ const cutoff = new Date(Date.now()-Number(days||14)*86400000).toISOString(); await db.from('report_events').delete().lt('created_at', cutoff); }catch(_){ }
      return true;
    }
  };

  const oldDeleteProject = api.deleteProject?.bind(api);
  api.deleteProject = async function(projectId){
    const user = await this.getCurrentUser?.(); if(!user) throw new Error('Nincs bejelentkezve.'); if(!projectId) throw new Error('Hiányzó projekt azonosító.');
    try{ const { data, error } = await db.rpc('delete_project_full_v117', { p_project_id: projectId }); if(!error && data !== false) return true; if(error && !missing(error)) throw error; }catch(e){ if(!missing(e)) console.warn('V117 RPC projekt törlés nem sikerült:', e.message||e); }
    try{ await db.from('report_events').delete().eq('report_id', projectId); }catch(_){ }
    try{ await db.from('report_events').delete().eq('project_id', projectId); }catch(_){ }
    if(oldDeleteProject) return oldDeleteProject(projectId);
    throw new Error('Projekt törlés nem sikerült. Futtasd a supabase-pro-v117-cleanup-and-fast-delete.sql fájlt.');
  };
})();
