import { randomUUID } from "node:crypto";

export function createDurableJobs({ env, fetch: fetchImpl, router }) {
  const enabled = env.WEB_DURABLE_JOBS === "true";
  const active = new Map();
  const base = String(env.WEB_SUPABASE_URL || "").replace(/\/+$/, "");
  const headers = {
    apikey: env.WEB_SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.WEB_SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
  };
  async function request(path, init = {}) {
    const response = await fetchImpl(`${base}/rest/v1/${path}`, {
      ...init,
      headers: { ...headers, ...init.headers },
      signal: AbortSignal.timeout(30000),
    });
    const body = await response.json();
    if (!response.ok) {
      const error = new Error(
        body?.message || body?.detail || "任务服务暂时不可用",
      );
      error.status = error.message.includes("insufficient_credits") ? 402 : 503;
      throw error;
    }
    return body;
  }
  const rpc = (name, body) =>
    request(`rpc/${name}`, { method: "POST", body: JSON.stringify(body) });
  const query = (user, id) =>
    `web_image_jobs?user_id=eq.${encodeURIComponent(user)}&id=eq.${encodeURIComponent(id)}&select=*`;
  const finish = (job, status, result) =>
    rpc("web_job_finish", {
      p_id: job.id,
      p_user_id: job.user_id,
      p_status: status,
      p_result: result,
    });
  function response(job) {
    return {
      task_id: job.id,
      status: job.status,
      ...(job.result || {}),
      billing_managed: true,
      credits_charged: job.status === "done" ? job.cost : 0,
      progress:
        job.status === "queued"
          ? "排队中"
          : job.status === "processing"
            ? "正在生成图片"
            : undefined,
    };
  }
  function run(job) {
    if (active.has(job.id)) return;
    const pending = (async () => {
      const claimed = await rpc("web_job_claim", {
        p_id: job.id,
        p_user_id: job.user_id,
      });
      if (!claimed) return;
      let result;
      try {
        result = await router.execute(
          claimed.payload.request,
          { id: claimed.user_id },
          claimed.id,
        );
      } catch (error) {
        result = { status: "error", error: error.message || "生成失败" };
      }
      // Persist result before exposing completion; retries only repeat settlement, never provider work.
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await finish(
            claimed,
            result.status === "done" ? "done" : "error",
            result,
          );
          return;
        } catch (error) {
          if (attempt === 4) throw error;
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
        }
      }
    })()
      .catch((error) =>
        console.error("durable_job_sync_failed", job.id, error.message),
      )
      .finally(() => active.delete(job.id));
    active.set(job.id, pending);
  }
  async function get(user, id) {
    let [job] = await request(query(user, id));
    if (!job) return null;
    if (job.status === "queued") run(job);
    if (
      job.status === "processing" &&
      !active.has(id) &&
      Date.parse(job.lease_until) < Date.now()
    ) {
      job = await finish(job, "error", {
        error: "生成服务已中断，预留积分已释放，请重试。",
      });
    }
    return response(job);
  }
  async function list(user, limit = 100, offset = 0, groupId) {
    const rows = groupId ? await request(
      `web_image_jobs?user_id=eq.${encodeURIComponent(user)}&group_id=eq.${encodeURIComponent(groupId)}&select=*&order=created_at.asc`,
    ) : await rpc("web_job_history", {
      p_user_id: user,
      p_limit: limit,
      p_offset: offset,
    });
    const grouped = new Map();
    for (const job of rows) {
      const group = grouped.get(job.group_id) || [];
      group.push(job);
      grouped.set(job.group_id, group);
    }
    return [...grouped].slice(0, limit).map(([id, jobs]) => {
      jobs.sort(
        (a, b) =>
          (a.payload.context.index || 0) - (b.payload.context.index || 0),
      );
      const context = jobs[0].payload.context;
      const done = jobs.filter((j) => j.status === "done");
      const failed = jobs.filter((j) => j.status === "error");
      const incomplete = jobs.length < context.total;
      const acceptingMissing =
        Date.now() - Date.parse(jobs[0].created_at) < 20 * 60 * 1000;
      const running =
        jobs.some((j) => ["queued", "processing"].includes(j.status)) ||
        (incomplete && acceptingMissing);
      const missingItems = [];
      if (incomplete && !acceptingMissing) {
        const config = context.config;
        const modules = config.module === "main_image"
          ? (config.selectedMainModules || [])
          : config.module === "detail_page"
            ? (config.detailModuleOrder || Object.keys(config.detailModuleCounts || {}))
              .flatMap((key) => Array.from({ length: config.detailModuleCounts?.[key] || 0 }, () => key))
            : [];
        for (let index = 0; index < context.total; index++) {
          if (jobs.some((job) => job.payload.context.index === index)) continue;
          const moduleId = modules[index];
          missingItems.push({
            index,
            label: `未送达图片 ${index + 1}`,
            config: {
              ...config,
              ...(config.module === "main_image" && moduleId ? { selectedMainModules: [moduleId] } : {}),
              ...(config.module === "detail_page" && moduleId ? { detailModuleCounts: { [moduleId]: 1 } } : {}),
            },
            error: "请求未送达，没有扣费，请重试。",
          });
        }
      }
      return {
        id,
        productInput: context.product,
        config: context.config,
        status: running
          ? "processing"
          : failed.length || incomplete
            ? done.length
              ? "partial"
              : "failed"
            : "completed",
        ...(incomplete && !acceptingMissing
          ? {
              errorMessage:
                "部分请求未送达，已保留成功结果；未提交图片没有扣费。",
            }
          : {}),
        resultUrls: done.map((j) => j.result.image_url),
        resultAssets: done.map((j) => ({
          url: j.result.image_url,
          label: j.payload.context.label,
          channelUsed: j.result.channel_used,
        })),
        failedItems: [...failed.map((j) => ({
          index: j.payload.context.index,
          label: j.payload.context.label,
          config: j.payload.context.childConfig,
          error: j.result?.error || "生成失败",
        })), ...missingItems].sort((a, b) => a.index - b.index),
        backendTaskIds: jobs.map((j) => j.id),
        creditCost: done.reduce((sum, j) => sum + j.cost, 0),
        billingManaged: true,
        createdAt: jobs[0].created_at,
        completedAt: running ? undefined : jobs.at(-1).updated_at,
        attempt: context.attempt || 1,
        progress: `已完成 ${done.length} / ${context.total} 张`,
      };
    });
  }
  async function recover() {
    const rows = await request(
      "web_image_jobs?status=in.(queued,processing)&select=*&order=created_at.asc&limit=100",
    );
    for (const job of rows) {
      if (job.status === "queued") run(job);
      else if (!active.has(job.id) && Date.parse(job.lease_until) < Date.now())
        await finish(job, "error", {
          error: "服务中断，积分预留已释放，请重试。",
        });
    }
  }
  return {
    enabled,
    get,
    list,
    request,
    rpc,
    recover,
    async submit(user, body) {
      const context = body.context;
      if (
        !context?.requestId ||
        !context?.groupId ||
        !context?.product?.imageUrl ||
        !context?.config?.module ||
        !Number.isInteger(context.index) ||
        context.index < 0 ||
        context.index >= context.total ||
        !Number.isInteger(context.total) ||
        context.total < 1 ||
        context.total > 200
      ) {
        throw Object.assign(new Error("请刷新网页后重新提交任务。"), {
          status: 422,
        });
      }
      const cost = { standard: 1, "2k": 2, "4k": 4 }[body.quality];
      if (!cost)
        throw Object.assign(new Error("不支持的清晰度"), { status: 422 });
      const requestBody = { ...body };
      delete requestBody.context;
      const job = await rpc("web_job_reserve", {
        p_id: `web-img-${randomUUID()}`,
        p_user_id: user,
        p_request_id: context.requestId,
        p_group_id: context.groupId,
        p_payload: { context, request: requestBody },
        p_cost: cost,
      });
      if (job.status === "queued") run(job);
      return response(job);
    },
    async cancel(user, id) {
      const [job] = await request(query(user, id));
      if (!job) return null;
      if (job.settled) return { canceled: false };
      router.cancel(id);
      const settled = await finish(job, "error", {
        error: "已取消，预留积分已释放。",
      });
      return { canceled: settled.status === "error" };
    },
  };
}
