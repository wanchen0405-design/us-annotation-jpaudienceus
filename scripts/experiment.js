function isArrayLikeTrials(x) {
    if (Array.isArray(x)) {
        return true;
    }
    return Object.prototype.toString.call(x) === "[object Array]";
}

// Resolve trial list from exp_sample.js (attached to window for reliable access across scripts).
function getImageListByGroup() {
    if (typeof window !== "undefined" && window.imageListByGroup != null) {
        return window.imageListByGroup;
    }
    if (typeof imageListByGroup !== "undefined") {
        return imageListByGroup;
    }
    return null;
}

// Flatten grouped trial data (trial_info/exp_sample.js) or use a plain array of trials.
function flattenTrialPool(source) {
    var rows = [];
    if (!source) {
        return rows;
    }
    if (isArrayLikeTrials(source)) {
        source.forEach(function(item) {
            rows.push(normalizeTrialRow(item));
        });
        return rows;
    }
    if (typeof source === "object") {
        Object.keys(source).forEach(function(groupKey) {
            var group = source[groupKey];
            var images = group && group.images;
            if (!Array.isArray(images)) {
                return;
            }
            images.forEach(function(img, idx) {
                var row = Object.assign({}, img, {
                    condition: img.condition != null ? img.condition : groupKey,
                    trial_id: img.trial_id != null ? img.trial_id : groupKey + "_" + idx
                });
                rows.push(normalizeTrialRow(row));
            });
        });
    }
    return rows;
}

function normalizeTrialRow(row) {
    var fp = row.filepath || row.filePath || "";
    if (fp && fp.indexOf("http") !== 0 && fp.indexOf("stimuli/") !== 0) {
        fp = "stimuli/" + fp;
    }
    return {
        trial_id: row.trial_id,
        condition: row.condition || "",
        filepath: fp,
        focal: row.focal || "",
        background: row.background || "",
        description: row.description || "",
        category: row.category || ""
    };
}

// customize the experiment by specifying a view order and a trial structure
exp.customize = function() {
    // record current date and time in global_data
    this.global_data.startDate = Date();
    this.global_data.startTime = Date.now();
    // specify view order
    this.views_seq = [
        informed_consent,
        intro,
        main,
        postTest,
        thanks
    ];
    const REQUIRED_TRIALS = 5;
    var trialSource = getImageListByGroup();
    let trial_pool = flattenTrialPool(trialSource != null ? trialSource : []);
    var trial_pool_size = trial_pool.length;

    // Each row should contain: condition, filepath, focal, background, description
    // (filePath and grouped JSON are normalized in flattenTrialPool.)
    console.log("=== Randomization starting ===");
    console.log("Total rows in trial pool:", trial_pool_size);
  
    // Step 2: shuffle all rows
    trial_pool = _.shuffle(trial_pool);
  
    // Step 3: select trials with no repeated focals/backgrounds
    const selected_trials = [];
    const used_focals = [];
    const used_backgrounds = [];
    const rejected_trials = [];
  
    for (let i = 0; i < trial_pool.length; i++) {
      const candidate = trial_pool[i];
  
      const focal_used = used_focals.includes(candidate.focal);
      const background_used = used_backgrounds.includes(candidate.background);
  
      if (focal_used || background_used) {
        rejected_trials.push({
          trial_id: candidate.trial_id,
          condition: candidate.condition,
          filepath: candidate.filepath,
          focal: candidate.focal,
          background: candidate.background,
          reason: [
            focal_used ? `focal already used: ${candidate.focal}` : null,
            background_used ? `background already used: ${candidate.background}` : null
          ].filter(Boolean).join(" | ")
        });
        continue;
      }
  
      selected_trials.push(candidate);
      used_focals.push(candidate.focal);
      used_backgrounds.push(candidate.background);
  
      console.log("✓ Selected:", {
        trial_id: candidate.trial_id,
        condition: candidate.condition,
        focal: candidate.focal,
        background: candidate.background,
        filepath: candidate.filepath
      });
  
      if (selected_trials.length === REQUIRED_TRIALS) {
        break;
      }
    }
  
    // Step 4: check whether enough valid trials were found
    if (selected_trials.length < REQUIRED_TRIALS) {
      console.error("❌ Not enough valid trials found.");
      console.error("Only selected:", selected_trials.length);
      console.error("Used focals:", used_focals);
      console.error("Used backgrounds:", used_backgrounds);
      console.error("Rejected trials:", rejected_trials);
  
      if (trial_pool_size === 0) {
        alert(
          "Randomization failed: no trials loaded. " +
          "Check that index.html includes trial_info/exp_sample.js before scripts/experiment.js, " +
          "that the file loads without errors, and that it defines imageListByGroup (also on window)."
        );
      } else {
        alert(
          `Randomization failed: only ${selected_trials.length} valid trials found. ` +
          `You need at least ${REQUIRED_TRIALS} trials with unique focals and backgrounds.`
        );
      }
    }
  
    // Step 5: shuffle selected trials again for final presentation order
    const final_trial_list = _.shuffle(selected_trials);
  
    // Step 6: validation
    const final_focals = final_trial_list.map(t => t.focal);
    const final_backgrounds = final_trial_list.map(t => t.background);
  
    const duplicate_focals = final_focals.filter((x, i) => final_focals.indexOf(x) !== i);
    const duplicate_backgrounds = final_backgrounds.filter((x, i) => final_backgrounds.indexOf(x) !== i);
  
    if (duplicate_focals.length > 0 || duplicate_backgrounds.length > 0) {
      console.error("❌ Validation failed.");
      console.error("Duplicate focals:", duplicate_focals);
      console.error("Duplicate backgrounds:", duplicate_backgrounds);
    } else {
      console.log("✓ Validation passed: no repeated focals or backgrounds.");
    }
  
    console.log("=== Final selected trials ===");
    console.log(final_trial_list);
  
    // Step 7: assign to main_trials
    main_trials = final_trial_list;
    this.trial_info.main_trials = main_trials;
  
    // Make sure the main view runs exactly the right number of trials
    if (typeof main !== "undefined" && Array.isArray(main_trials)) {
      main.trials = main_trials.length;
    }
  
    // Progress bar settings
    this.progress_bar_in = ["main"];
    this.progress_bar_style = "default";
    this.progress_bar_width = 100;
};