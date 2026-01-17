console.log('Custom.js loaded!');

Reveal.on('ready', function() {
    console.log('Reveal ready event fired!');
    
    // Wait for math rendering to complete before sizing
    // Use requestAnimationFrame to wait for next paint cycle after ready
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            centerMathBlocks();
            adjustFontSizeForCurrentSlide();
            adjustFontSizeForAllSlides();
        });
    });
    
    // Numerazione slide
    const sections = document.querySelectorAll('.reveal .slides section');
    sections.forEach((section, index) => {
        section.setAttribute('data-slide-number', index + 1);
    });

    // When reveal.js finishes building the print layout, ensure defaults and rerun adjustments
    Reveal.on('pdf-ready', function() {
        // Ensure cloned slides inside .pdf-page have a default data-state of "normal"
        const pdfSections = document.querySelectorAll('.pdf-page > section');
        pdfSections.forEach((section) => {
            const stateAttr = section.getAttribute('data-state');
            if (!stateAttr || stateAttr.trim() === '') {
                section.setAttribute('data-state', 'normal');
            }
        });

        // Re-run adjustments after the print layout has been applied
        setTimeout(function() {
            centerMathBlocks();
            adjustFontSizeForAllSlides();
        }, 50);
    });

    // Ensure slides without data-state default to "normal"
    sections.forEach((section) => {
        const stateAttr = section.getAttribute('data-state');
        if (!stateAttr || stateAttr.trim() === '') {
            section.setAttribute('data-state', 'normal');
        }
    });

    // Sync body class for default slides (so background works for default normal slides)
    syncBodyClassWithCurrentSlide();
});

Reveal.on('slidechanged', function() {
    // Re-adjust on slide change (in case of dynamic content)
    // Only measure the visible slide: hidden slides can report different heights
    // and overwrite classes with incorrect values.
    adjustFontSizeForCurrentSlide();
    // Some slides contain images that load after the slide becomes visible.
    // Re-run after a short delay so measurements reflect final layout.
    setTimeout(adjustFontSizeForCurrentSlide, 200);
    // Sync body class for default slides on navigation
    syncBodyClassWithCurrentSlide();
    // Center math blocks on slide change
    setTimeout(centerMathBlocks, 50);
});

function adjustFontSizeForCurrentSlide() {
    const current = Reveal.getCurrentSlide();
    if (current) {
        adjustFontSizeForSection(current);
    }
    // Print-pdf clones must be processed as a whole document
    if (document.body.classList.contains('print-pdf')) {
        adjustFontSizeForAllSlides();
    }
}

function adjustFontSizeForSection(section) {
    const contentDiv = section.querySelector('.content-center');
    if (!contentDiv) return;

    // If the slide contains images that are not yet loaded, measurements will be wrong.
    const imgs = Array.from(contentDiv.querySelectorAll('img'));
    const pendingImgs = imgs.filter(img => !img.complete);
    if (pendingImgs.length > 0) {
        if (!section.__fontResizeWaitingForImages) {
            section.__fontResizeWaitingForImages = true;
            const onDone = () => {
                section.__fontResizeWaitingForImages = false;
                adjustFontSizeForSection(section);
            };
            pendingImgs.forEach(img => {
                img.addEventListener('load', onDone, { once: true });
                img.addEventListener('error', onDone, { once: true });
            });
        }
        return;
    }

    // Remove any existing font size classes first to get accurate measurement
    section.classList.remove('font-small', 'font-smaller', 'font-smallest', 'font-tinier', 'font-tiniest');
    
    // Force a complete reflow after removing classes
    section.offsetHeight;
    contentDiv.offsetHeight;

    // Perform measurement immediately without setTimeout to avoid visible delay
    performMeasurement();
    
    function performMeasurement() {
        // Check if this is a two-column layout
        const hasColumns = contentDiv.querySelector('.col') !== null;

        // Force multiple reflows to ensure KaTeX formulas are fully rendered
        contentDiv.offsetHeight;
        
        // Wait for any pending KaTeX rendering
        const katexElements = contentDiv.querySelectorAll('.katex, .katex-display, mjx-container');
        if (katexElements.length > 0) {
            // Force reflow on each math element
            katexElements.forEach(el => el.offsetHeight);
        }
        
        // Calculate total content height by summing all direct children heights
        let contentHeight = 0;
        const children = Array.from(contentDiv.children);
        
        for (const child of children) {
            const rect = child.getBoundingClientRect();
            contentHeight += rect.height;
            
            // Add margin-bottom if present
            const style = window.getComputedStyle(child);
            const marginBottom = parseFloat(style.marginBottom) || 0;
            contentHeight += marginBottom;
        }
        
        const availableHeight = contentDiv.clientHeight;
        const heightRatio = contentHeight / availableHeight;
        
        const h2Any = section.querySelector('h2');
        const h2Text = h2Any ? h2Any.textContent : '(no h2)';
        console.log('Slide:', h2Text, '| Content:', contentHeight.toFixed(1), '| Available:', availableHeight.toFixed(1), '| Ratio:', heightRatio.toFixed(4));

        let appliedClass = 'none';
        if (hasColumns) {
            // Check if any column contains code blocks
            const hasCodeInColumns = contentDiv.querySelector('.col pre') !== null;
            
            if (hasCodeInColumns) {
                // For columns with code: count actual content lines more accurately
                const codeBlocks = contentDiv.querySelectorAll('.col pre code');
                let maxLines = 0;
                let totalContentLines = 0;
                
                codeBlocks.forEach(code => {
                    const text = code.textContent || '';
                    // Count non-empty lines
                    const lines = text.split('\n').filter(line => line.trim().length > 0);
                    const lineCount = lines.length;
                    maxLines = Math.max(maxLines, lineCount);
                    totalContentLines += lineCount;
                    console.log('  -> Code block lines:', lineCount, 'chars:', text.length);
                });
                
                // Also count list items and other content in columns
                const listItems = contentDiv.querySelectorAll('.col li');
                const listItemCount = listItems.length;
                totalContentLines += listItemCount;
                
                console.log('  -> Total content lines in columns:', totalContentLines, 'max code lines:', maxLines, 'list items:', listItemCount);
                
                // Apply aggressive font reduction for columns with code
                // Base font is too large for column layouts with code - default to tiniest
                if (totalContentLines <= 3 && maxLines <= 2) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (totalContentLines <= 5 && maxLines <= 3) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else {
                    // For most cases with code in columns, use tiniest
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                }
            } else {
                // Original logic for columns without code
                if (heightRatio > 1.15) {
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                } else if (heightRatio > 1.05) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (heightRatio > 0.95) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (heightRatio > 0.85) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            }
        } else {
            const hasCode = contentDiv.querySelector('pre') !== null;
            if (hasCode) {
                if (heightRatio > 0.95) {
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                } else if (heightRatio > 0.87) {
                    section.classList.add('font-tinier');
                    appliedClass = 'font-tinier';
                } else if (heightRatio > 0.78) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (heightRatio > 0.68) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (heightRatio > 0.60) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            } else {
                if (heightRatio > 1.00) {
                    section.classList.add('font-tiniest');
                    appliedClass = 'font-tiniest';
                } else if (heightRatio > 0.92) {
                    section.classList.add('font-tinier');
                    appliedClass = 'font-tinier';
                } else if (heightRatio > 0.84) {
                    section.classList.add('font-smallest');
                    appliedClass = 'font-smallest';
                } else if (heightRatio > 0.76) {
                    section.classList.add('font-smaller');
                    appliedClass = 'font-smaller';
                } else if (heightRatio > 0.60) {
                    section.classList.add('font-small');
                    appliedClass = 'font-small';
                }
            }
        }

        console.log('  -> Applied class:', appliedClass);
    }
}

function adjustFontSizeForAllSlides() {
    // Apply auto-resize to both on-screen normal slides and print-pdf clones
    const sections = document.querySelectorAll(
        '.reveal .slides section[data-state~="normal"], .pdf-page > section[data-state~="normal"]'
    );
    
    sections.forEach((section) => {
        adjustFontSizeForSection(section);
    });
}

function syncBodyClassWithCurrentSlide() {
    const current = Reveal.getCurrentSlide();
    if (!current) return;
    const stateStr = (current.getAttribute('data-state') || '').trim();
    const tokens = stateStr ? stateStr.split(/\s+/) : [];
    const isNormal = tokens.includes('normal') || tokens.length === 0;
    document.body.classList.toggle('normal', isNormal);
}

function centerMathBlocks() {
    // KaTeX display math blocks
    const katexDisplays = document.querySelectorAll('section[data-state~="normal"] .content-center .katex-display');
    katexDisplays.forEach(math => {
        math.style.setProperty('text-align', 'center', 'important');
        math.style.setProperty('margin-left', 'auto', 'important');
        math.style.setProperty('margin-right', 'auto', 'important');
        math.style.setProperty('display', 'block', 'important');
        
        // Center the parent paragraph
        let parent = math.parentElement;
        while (parent && parent.tagName !== 'P' && parent !== document.body) {
            parent = parent.parentElement;
        }
        if (parent && parent.tagName === 'P') {
            parent.style.setProperty('text-align', 'center', 'important');
        }
    });
}
