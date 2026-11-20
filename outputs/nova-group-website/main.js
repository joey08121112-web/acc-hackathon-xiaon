(() => {
  'use strict';

  /* ========================================================================
     1. 深浅色二态切换（严格遵循 dark-mode-toggle：回归系统默认时移除键值）
     ======================================================================== */
  const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

  const getStoredScheme = () => {
    try {
      const value = localStorage.getItem('color-scheme');
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  };

  const applySchemeToMeta = (scheme) => {
    if (!colorSchemeMeta) return;
    colorSchemeMeta.content = scheme === 'light' || scheme === 'dark' ? scheme : 'light dark';
  };

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const systemScheme = darkMedia.matches ? 'dark' : 'light';
      const currentRendered = getStoredScheme() ?? systemScheme;
      const targetScheme = currentRendered === 'dark' ? 'light' : 'dark';

      if (targetScheme === systemScheme) {
        try {
          localStorage.removeItem('color-scheme');
        } catch {}
        applySchemeToMeta(null);
      } else {
        try {
          localStorage.setItem('color-scheme', targetScheme);
        } catch {}
        applySchemeToMeta(targetScheme);
      }
    });
  }

  window.addEventListener('storage', (event) => {
    if (event.key === 'color-scheme') {
      applySchemeToMeta(getStoredScheme());
    }
  });

  /* ========================================================================
     2. 原生 <dialog> 轻退关闭兜底与 returnValue 重置
     ======================================================================== */
  const modalDialogs = Array.from(document.querySelectorAll('dialog[closedby="any"]'));

  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutsideDialog = (event, dialog) => {
      const rect = dialog.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };

    for (const dialog of modalDialogs) {
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (event) => {
        pressedOutside = isOutsideDialog(event, dialog);
      });
      dialog.addEventListener('pointerup', (event) => {
        if (pressedOutside && isOutsideDialog(event, dialog)) {
          dialog.close();
        }
        pressedOutside = false;
      });
    }
  }

  for (const dialog of document.querySelectorAll('dialog')) {
    dialog.addEventListener('close', () => {
      dialog.returnValue = '';
    });
  }

  /* ========================================================================
     3. 移动端原生 <dialog> 抽屉导航（遵循 navigation-drawer）
     ======================================================================== */
  const drawer = document.getElementById('mobile-drawer');
  const drawerOpenBtn = document.getElementById('drawer-open');
  const drawerCloseBtn = document.getElementById('drawer-close');

  if (drawer && drawerOpenBtn && drawerCloseBtn) {
    const scroller = drawer.querySelector('.drawer-scroller');
    const sheet = drawer.querySelector('.drawer-sheet');
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let drawerClosingFallbackTimer = null;

    const openDrawer = async () => {
      if (drawer.open) return;
      drawer.showModal();
      drawerOpenBtn.setAttribute('aria-expanded', 'true');

      if (!CSS.supports('scroll-initial-target', 'nearest') && !prefersReducedMotion.matches) {
        scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'instant' });
        await new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
      }

      scroller.scrollTo({ left: 0, behavior: prefersReducedMotion.matches ? 'instant' : 'auto' });
      if (!CSS.supports('animation-timeline: scroll()')) {
        drawer.style.setProperty('--drawer-backdrop', '1');
      }
    };

    const closeDrawer = () => {
      if (!drawer.open) return;
      if (prefersReducedMotion.matches) {
        drawer.close();
        drawerOpenBtn.setAttribute('aria-expanded', 'false');
        return;
      }
      scroller.scrollTo({ left: scroller.offsetWidth, behavior: 'auto' });
      clearTimeout(drawerClosingFallbackTimer);
      drawerClosingFallbackTimer = setTimeout(() => {
        if (drawer.open && scroller.scrollLeft >= sheet.offsetWidth * 0.85) {
          drawer.close();
          drawerOpenBtn.setAttribute('aria-expanded', 'false');
        }
      }, 420);
    };

    if (!CSS.supports('animation-timeline: scroll()')) {
      scroller.addEventListener('scroll', () => {
        const width = sheet.offsetWidth || 1;
        const ratio = Math.max(0, Math.min(1, 1 - scroller.scrollLeft / width));
        drawer.style.setProperty('--drawer-backdrop', String(ratio));
      });
    }

    const visibleThreshold = Math.min(0.02, 1 / Math.max(window.innerWidth, 320));
    const drawerObserver = new IntersectionObserver(
      (entries) => {
        if (!drawer.open) return;
        const entry = entries.at(-1);
        if (!entry) return;
        if (entry.intersectionRatio < visibleThreshold) {
          clearTimeout(drawerClosingFallbackTimer);
          drawer.close();
          drawerOpenBtn.setAttribute('aria-expanded', 'false');
        } else if (entry.intersectionRatio >= 0.98) {
          drawerOpenBtn.setAttribute('aria-expanded', 'true');
        }
      },
      { root: drawer, threshold: [visibleThreshold, 0.98] }
    );
    drawerObserver.observe(sheet);

    drawerOpenBtn.addEventListener('click', openDrawer);
    drawerCloseBtn.addEventListener('click', closeDrawer);

    drawer.addEventListener('click', (event) => {
      if (!sheet.contains(event.target)) {
        closeDrawer();
      }
    });

    drawer.addEventListener('cancel', (event) => {
      if (event.cancelable) {
        event.preventDefault();
        closeDrawer();
      }
    });

    drawer.addEventListener('close', () => {
      clearTimeout(drawerClosingFallbackTimer);
      drawerOpenBtn.setAttribute('aria-expanded', 'false');
    });

    for (const link of drawer.querySelectorAll('.drawer-links a')) {
      link.addEventListener('click', () => {
        drawer.close();
      });
    }
  }

  /* ========================================================================
     4. 四大业务矩阵：可访问 Tab 面板（键盘切换 + hidden="until-found" beforematch）
     ======================================================================== */
  const tabRoot = document.getElementById('ecosystem-tabs');
  if (tabRoot) {
    const tabs = Array.from(tabRoot.querySelectorAll('[role="tab"]'));
    const panels = Array.from(tabRoot.querySelectorAll('[role="tabpanel"]'));

    const activateTab = (targetTab, { moveFocus = false } = {}) => {
      for (const tab of tabs) {
        const isSelected = tab === targetTab;
        tab.setAttribute('aria-selected', String(isSelected));
        tab.tabIndex = isSelected ? 0 : -1;
        tab.toggleAttribute('focusgroupstart', isSelected);
      }

      for (const panel of panels) {
        const isMatch = panel.getAttribute('aria-labelledby') === targetTab.id;
        if (isMatch) {
          panel.removeAttribute('hidden');
          panel.tabIndex = 0;
        } else {
          panel.setAttribute('hidden', 'until-found');
          panel.removeAttribute('tabindex');
        }
      }

      if (moveFocus) {
        targetTab.focus();
      }

      try {
        targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest', container: 'nearest' });
      } catch {
        targetTab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    };

    for (const tab of tabs) {
      tab.addEventListener('click', () => activateTab(tab));
      tab.addEventListener('keydown', (event) => {
        const currentIndex = tabs.indexOf(tab);
        let nextIndex = null;

        if (event.key === 'ArrowRight') {
          nextIndex = (currentIndex + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft') {
          nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          nextIndex = 0;
        } else if (event.key === 'End') {
          nextIndex = tabs.length - 1;
        }

        if (nextIndex !== null) {
          event.preventDefault();
          activateTab(tabs[nextIndex], { moveFocus: true });
        }
      });
    }

    for (const panel of panels) {
      panel.addEventListener('beforematch', () => {
        const matchingTab = document.getElementById(panel.getAttribute('aria-labelledby'));
        if (matchingTab) activateTab(matchingTab);
      });
    }
  }

  /* ========================================================================
     5. 五维探索世界：交互式五站图谱检查器
     ======================================================================== */
  const STATIONS = {
    understanding: {
      dimTag: 'DIMENSION 01 · 理解能力',
      status: '已上线',
      isLive: true,
      title: '理解花园 · 星溪镇（钟声响起之前）',
      desc: '深度融合《星溪镇：钟声响起之前》互动叙事体验。学生不必在题海里找答案，而是跟着小N 走进星溪镇听故事、拆线索，把复杂条件和运算顺序梳理清楚；通关后自动点亮地图第一站，并将探索回顾写入「我的档案」。',
      focus: '能不能读清题干条件、关键词与运算顺序',
      format: '同源互动叙事小游戏 + 专业模式五维问答契约'
    },
    spatial: {
      dimTag: 'DIMENSION 05 · 空间想象',
      status: '已上线',
      isLive: true,
      title: '空间山丘 · 星象风车台',
      desc: '围绕二维旋转、视角转换与方位位置关系打造互动观测任务。学生在星象风车台中亲手观察方位变化并说明判断依据，系统记录空间推理过程而非单纯对错。',
      focus: '能不能判断二维旋转、对称与空间位置关系变化',
      format: '已上线互动探索站点 + 空间观察追问'
    },
    logic: {
      dimTag: 'DIMENSION 02 · 逻辑推理',
      status: '研发规划中',
      isLive: false,
      title: '逻辑小桥 · 温室水路',
      desc: '规划以「修复温室水路」2D 网格切片（6×4 网格、预算 8 币）承载控制单变量比较与反例检验；设计为无 AI 环境也可完整游玩的分级提示机制（H0–H4），AI 情境帮助作为可开关增量。',
      focus: '能不能用反例检验一句话，并做“一次只改一处”的对比推理',
      format: '当前保留专业模式生活故事问答；2D 网格切片规划研发中'
    },
    calculation: {
      dimTag: 'DIMENSION 03 · 计算能力',
      status: '研发规划中',
      isLive: false,
      title: '计算工坊',
      desc: '承接初中代数核心运算（去括号负号、合并同类项等），与 E1 受控变式出题及确定性判题器联动，持续观测学生从“提示后做对”到“跨场次新题独立做对”的稳定迁移。',
      focus: '能不能准确处理代数式符号变换、括号与同类项合并',
      format: '当前已在核心练习闭环运行；工坊互动可视化场景规划中'
    },
    modeling: {
      dimTag: 'DIMENSION 04 · 数学建模',
      status: '研发规划中',
      isLive: false,
      title: '生活集市',
      desc: '从生活里的真实账单、价签核对、固定费用与按数量变化费用出发，引导学生在具体情境里识别变量关系，将日常语言逐步抽象为清晰的数学表达式。',
      focus: '能不能把现实数量关系写成清晰、可检验的数学式子',
      format: '当前保留专业模式生活故事测评；集市互动场景规划中'
    }
  };

  const stationBtns = Array.from(document.querySelectorAll('[data-station]'));
  const stationDots = Array.from(document.querySelectorAll('[data-station-dot]'));
  const stationDimTag = document.getElementById('station-dim-tag');
  const stationStatusBadge = document.getElementById('station-status-badge');
  const stationTitle = document.getElementById('station-title');
  const stationDesc = document.getElementById('station-desc');
  const stationFocus = document.getElementById('station-focus');
  const stationFormat = document.getElementById('station-format');

  const selectStation = (key) => {
    const data = STATIONS[key];
    if (!data) return;

    for (const btn of stationBtns) {
      const active = btn.dataset.station === key;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    }

    for (const dot of stationDots) {
      dot.classList.toggle('is-selected', dot.dataset.stationDot === key);
    }

    if (stationDimTag) stationDimTag.textContent = data.dimTag;
    if (stationStatusBadge) {
      stationStatusBadge.textContent = data.status;
      stationStatusBadge.classList.toggle('status-live', data.isLive);
      stationStatusBadge.classList.toggle('status-plan', !data.isLive);
    }
    if (stationTitle) stationTitle.textContent = data.title;
    if (stationDesc) stationDesc.textContent = data.desc;
    if (stationFocus) stationFocus.textContent = data.focus;
    if (stationFormat) stationFormat.textContent = data.format;
  };

  for (const btn of stationBtns) {
    btn.addEventListener('click', () => selectStation(btn.dataset.station));
  }

  for (const dot of stationDots) {
    dot.style.cursor = 'pointer';
    dot.addEventListener('click', () => selectStation(dot.dataset.stationDot));
  }

  /* ========================================================================
     6. 合作咨询弹窗、交互后表单校验与本地静态回执
     ======================================================================== */
  const contactDialog = document.getElementById('contact-dialog');
  const contactForm = document.getElementById('contact-form');
  const contactReceipt = document.getElementById('contact-receipt');
  const partnerSelect = document.getElementById('partner-type');
  const contactCancelBtn = document.getElementById('contact-cancel-btn');
  const receiptPreview = document.getElementById('receipt-preview');
  const copyTemplateBtn = document.getElementById('copy-template-btn');
  const copyStatus = document.getElementById('copy-status');
  const receiptResetBtn = document.getElementById('receipt-reset-btn');

  const previewDialog = document.getElementById('preview-dialog');
  const openPreviewBtn = document.getElementById('open-preview-btn');
  const previewToContactBtn = document.getElementById('preview-to-contact');

  // 单一礼貌朗读 live region（遵循 accessible-error-announcement）
  const announcer = document.createElement('div');
  announcer.setAttribute('aria-live', 'polite');
  announcer.className = 'visually-hidden';
  document.body.append(announcer);

  let announceTimer = null;
  let announcedField = null;
  const supportsUserInvalid = CSS.supports('selector(:user-invalid)');
  const dirtyState = new WeakMap();
  const flaggedFields = new WeakSet();
  const announcedFields = new WeakSet();

  const linkError = (el, shown) => {
    const errorId = el.dataset.error;
    if (!errorId) return;
    const ids = (el.getAttribute('aria-describedby') || '')
      .split(/\s+/)
      .filter((id) => id && id !== errorId);
    if (shown) ids.push(errorId);
    if (ids.length) {
      el.setAttribute('aria-describedby', ids.join(' '));
    } else {
      el.removeAttribute('aria-describedby');
    }
  };

  const announceFieldError = (el) => {
    const errorEl = el.dataset.error ? document.getElementById(el.dataset.error) : null;
    if (!errorEl) return;
    const labelText = el.labels?.[0]?.textContent?.replace(/\*/g, '').trim() || '';
    clearTimeout(announceTimer);
    announcer.textContent = '';
    announcedField = el;
    announceTimer = setTimeout(() => {
      announcer.textContent = `${labelText ? `${labelText}：` : ''}${errorEl.textContent.trim()}`;
    }, 350);
  };

  const syncFieldState = (el, { forceShow = false, announce = false } = {}) => {
    if (!el || !el.matches?.('input, select, textarea')) return;
    const isValid = el.validity.valid;
    let shouldShowInvalid = false;

    if (supportsUserInvalid && !forceShow) {
      shouldShowInvalid = el.matches(':user-invalid');
      el.classList.remove('user-invalid-fallback', 'user-valid-fallback');
    } else {
      const state = dirtyState.get(el) || { hasInteracted: false, hasBlurred: false };
      if (forceShow) {
        state.hasInteracted = true;
        state.hasBlurred = true;
        dirtyState.set(el, state);
      }
      shouldShowInvalid = !isValid && state.hasInteracted && state.hasBlurred;
      el.classList.toggle('user-invalid-fallback', shouldShowInvalid);
      el.classList.toggle('user-valid-fallback', isValid && state.hasInteracted && state.hasBlurred);
    }

    if (shouldShowInvalid) {
      if (announce && !announcedFields.has(el)) {
        announceFieldError(el);
        announcedFields.add(el);
      }
      el.setAttribute('aria-invalid', 'true');
      linkError(el, true);
      flaggedFields.add(el);
    } else if (flaggedFields.has(el) || el.getAttribute('aria-invalid') !== 'true') {
      el.setAttribute('aria-invalid', 'false');
      linkError(el, false);
      flaggedFields.delete(el);
      announcedFields.delete(el);
      if (announcedField === el) {
        clearTimeout(announceTimer);
        announcer.textContent = '';
      }
    }
  };

  const resetContactFormState = () => {
    if (!contactForm || !contactReceipt) return;
    contactForm.hidden = false;
    contactReceipt.hidden = true;
    if (copyStatus) copyStatus.textContent = '';
    for (const control of contactForm.querySelectorAll('input, select, textarea')) {
      dirtyState.delete(control);
      flaggedFields.delete(control);
      announcedFields.delete(control);
      control.classList.remove('user-invalid-fallback', 'user-valid-fallback');
      control.setAttribute('aria-invalid', 'false');
      linkError(control, false);
    }
  };

  const openContactDialog = (preset) => {
    if (!contactDialog) return;
    if (drawer?.open) {
      drawer.close();
    }
    resetContactFormState();
    if (preset && partnerSelect) {
      const hasOption = Array.from(partnerSelect.options).some((opt) => opt.value === preset);
      if (hasOption) partnerSelect.value = preset;
    }
    contactDialog.showModal();
  };

  for (const trigger of document.querySelectorAll('[data-open-contact]')) {
    trigger.addEventListener('click', () => {
      openContactDialog(trigger.dataset.partnerPreset || '');
    });
  }

  if (openPreviewBtn && previewDialog) {
    openPreviewBtn.addEventListener('click', () => {
      previewDialog.showModal();
    });
  }

  if (previewToContactBtn && previewDialog) {
    previewToContactBtn.addEventListener('click', () => {
      previewDialog.close();
      openContactDialog('学校小范围试点');
    });
  }

  if (contactForm && contactDialog) {
    const formControls = Array.from(contactForm.querySelectorAll('input, select, textarea'));
    for (const control of formControls) {
      control.setAttribute('aria-invalid', 'false');
    }

    contactForm.addEventListener('input', (event) => {
      const target = event.target;
      const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
      state.hasInteracted = true;
      dirtyState.set(target, state);
      syncFieldState(target);
    });

    contactForm.addEventListener(
      'blur',
      (event) => {
        const target = event.target;
        const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
        state.hasBlurred = true;
        dirtyState.set(target, state);
        syncFieldState(target, { announce: true });
      },
      true
    );

    contactForm.addEventListener(
      'change',
      (event) => {
        const target = event.target;
        const state = dirtyState.get(target) || { hasInteracted: false, hasBlurred: false };
        state.hasInteracted = true;
        state.hasBlurred = true;
        dirtyState.set(target, state);
        syncFieldState(target, { announce: true });
      },
      true
    );

    if (contactCancelBtn) {
      contactCancelBtn.addEventListener('click', () => {
        contactDialog.close('cancel');
      });
    }

    let lastTemplateText = '';

    contactForm.addEventListener('submit', (event) => {
      event.preventDefault();

      let firstInvalid = null;
      for (const control of formControls) {
        if (!control.validity.valid) {
          announcedFields.add(control);
          control.classList.add('user-invalid-fallback');
          syncFieldState(control, { forceShow: true, announce: false });
          if (!firstInvalid) firstInvalid = control;
        } else {
          syncFieldState(control);
        }
      }

      if (firstInvalid) {
        firstInvalid.focus();
        return;
      }

      const data = new FormData(contactForm);
      const refId = `NOVA-${Date.now().toString(36).slice(-6).toUpperCase()}`;
      const partnerType = String(data.get('partnerType') || '').trim();
      const name = String(data.get('name') || '').trim();
      const org = String(data.get('organization') || '').trim() || '未填写';
      const email = String(data.get('email') || '').trim();
      const notes = String(data.get('notes') || '').trim();

      lastTemplateText = [
        `【NOVA 教育科技合作咨询 · ${refId}】`,
        `合作方向：${partnerType}`,
        `联系人：${name}`,
        `所属机构：${org}`,
        `联系邮箱：${email}`,
        `交流需求：${notes}`,
        `开源仓库参考：https://github.com/joey08121112-web/acc-hackathon-xiaon`
      ].join('\n');

      if (receiptPreview) receiptPreview.textContent = lastTemplateText;
      contactForm.hidden = true;
      contactReceipt.hidden = false;
      if (copyStatus) copyStatus.textContent = '';
      copyTemplateBtn?.focus();
    });

    if (copyTemplateBtn) {
      copyTemplateBtn.addEventListener('click', async () => {
        if (!lastTemplateText) return;
        try {
          await navigator.clipboard.writeText(lastTemplateText);
          if (copyStatus) copyStatus.textContent = '已复制合作联系模板到剪贴板。';
        } catch {
          if (copyStatus) copyStatus.textContent = '当前环境不支持自动剪贴板，请直接选中上方回执文本复制。';
        }
      });
    }

    if (receiptResetBtn) {
      receiptResetBtn.addEventListener('click', () => {
        contactForm.reset();
        resetContactFormState();
        partnerSelect?.focus();
      });
    }
  }
})();
