(() => {
    "use strict";

    const clampUnitLinear = (samplePoint) => Math.min(Math.max(samplePoint, 0), 1);

    const SURFACE_EVAL_RESULT = { height: 0, derivative: 0 };

    const SURFACE_EVAL_FNS = {
        convex_squircle: (x) => {
            const u = 1 - x;
            const u2 = u * u;
            const radC = Math.max(1e-10, 1 - u2);
            const c = Math.sqrt(radC);
            const rad4 = Math.max(1e-10, 1 - u2 * u2);
            const s2 = Math.sqrt(rad4);
            const s = Math.sqrt(s2);
            const height = 0.70 * s + 0.30 * c;
            const invDenom = 1 / (s * s2 * c);
            const derivative = u * (0.70 * u2 * c + 0.30 * s * s2) * invDenom;
            SURFACE_EVAL_RESULT.height = height;
            SURFACE_EVAL_RESULT.derivative = derivative;
            return SURFACE_EVAL_RESULT;
        },
        convex_circle: (x) => {
            const u = 1 - x;
            const radC = Math.max(1e-10, 1 - u * u);
            const c = Math.sqrt(radC);
            const height = c;
            const derivative = u / c;
            SURFACE_EVAL_RESULT.height = height;
            SURFACE_EVAL_RESULT.derivative = derivative;
            return SURFACE_EVAL_RESULT;
        },
        linear: (x) => {
            const height = Math.min(Math.max(x, 0), 1);
            const derivative = (x > 0 && x < 1) ? 1 : 0;
            SURFACE_EVAL_RESULT.height = height;
            SURFACE_EVAL_RESULT.derivative = derivative;
            return SURFACE_EVAL_RESULT;
        },
        lip: (x) => {
            const u = 1 - x;
            const xu = x * u;
            const xu2 = xu * xu;
            const x2 = x * x;
            const piX = Math.PI * x;
            const sinPiX = Math.sin(piX);
            const cosPiX = Math.cos(piX);

            const concave = x2 * (3 - 2 * x) - 0.15 * xu2 * sinPiX;
            const dConcave = 6 * xu - 0.15 * (2 * xu * (1 - 2 * x) * sinPiX + Math.PI * xu2 * cosPiX);

            let convex;
            let dConvex;
            if (x < 0.5) {
                const ucd = 1 - 2 * x;
                const comp2 = ucd * ucd;
                const rad4 = Math.max(1e-10, 1 - comp2 * comp2);
                const s2 = Math.sqrt(rad4);
                const s = Math.sqrt(s2);
                convex = s;
                dConvex = (2 * ucd * comp2) / (s * s2);
            } else {
                convex = 1;
                dConvex = 0;
            }

            const t = ((6 * x - 15) * x + 10) * x2 * x;
            const dt = 30 * xu2;

            const height = convex * (1 - t) + concave * t;
            const derivative = dConvex * (1 - t) + dConcave * t + (concave - convex) * dt;
            SURFACE_EVAL_RESULT.height = height;
            SURFACE_EVAL_RESULT.derivative = derivative;
            return SURFACE_EVAL_RESULT;
        },
    };

    const SURFACE_FNS = {
        convex_squircle: (samplePoint) => SURFACE_EVAL_FNS.convex_squircle(samplePoint).height,
        convex_circle: (samplePoint) => SURFACE_EVAL_FNS.convex_circle(samplePoint).height,
        linear: clampUnitLinear,
        lip: (samplePoint) => SURFACE_EVAL_FNS.lip(samplePoint).height,
    };

    const GLASS_NEUTRAL_PIXEL = 0xFF808080;

    const ign = (x, y) => {
        const f = 0.06711056 * x + 0.00583715 * y;
        const frac = f - Math.floor(f);
        const g = 52.9829189 * frac;
        return (g - Math.floor(g)) - 0.5;
    };

    const INV_65536 = 1 / 65536;

    const hash32 = (x, y) => {
        const h = Math.imul(x, 0xC13FA9A9) ^ Math.imul(y, 0x91E10DA5);
        return Math.imul(h ^ (h >>> 16), 0x7FEB352D);
    };

    const hashDither2D = (x, y) => {
        const h = hash32(x, y);
        return {
            dx: ((h << 16) >> 16) * INV_65536,
            dy: (h >> 16) * INV_65536,
        };
    };

    const EDGE_TAPER = 0.04;

    const MAP_MAX_SCALE = 2;
    const MAP_MIN_SCALE = 0.25;
    const MAP_MAX_PIXELS = 16_384;
    const MAP_PRELOAD_TIMEOUT_MS = 350;
    const QUANTIZE_GRID = 8;

    const NAV_SLICED_MAP = false;
    const LIGHT_TIER_ON_SCROLL = false;
    const PREBLUR_MODE = "css";
    const BLUR_EDGE_MODE = "duplicate";

    function pickMapScale(w, h, rasterScale, bezel, radius = 0, blurAmt = 0) {
        const minDim = Math.max(1, Math.min(w, h));
        const halfMinDim = minDim * 0.5;
        const effectiveRadius = radius > 0 ? Math.min(radius, halfMinDim) : halfMinDim;

        const cornerFloor = effectiveRadius > 1
            ? Math.min(1.5, Math.max(1.0, (blurAmt > 0 ? 18 : 24) / effectiveRadius))
            : 0.5;
        const bezelFloor = bezel > 0
            ? Math.min(1.5, Math.max(blurAmt > 0 ? 0.65 : 0.75, (blurAmt > 0 ? 8 : 12) / Math.max(bezel, 0.5)))
            : 0.5;
        const floorScale = Math.max(cornerFloor, bezelFloor, 16 / minDim);

        const effectiveDpr = Math.min(rasterScale, 1.5);
        let subNyquistFactor = effectiveRadius > 1 ? 1.0 : ((bezel >= 8 || minDim >= 40) ? 0.65 : 0.85);

        if (blurAmt > 0) {
            if (effectiveRadius <= 1) {
                subNyquistFactor *= 1 / Math.sqrt(1 + 0.5 * blurAmt * blurAmt);
            } else {
                const blurAttenuation = 1 / Math.sqrt(1 + 0.15 * blurAmt * blurAmt);
                subNyquistFactor = Math.max(0.85, subNyquistFactor * blurAttenuation);
            }
        }

        let s = Math.min(effectiveDpr * subNyquistFactor, MAP_MAX_SCALE);
        s = Math.max(s, Math.min(floorScale, MAP_MAX_SCALE));

        const activeW = Math.min(w, 2 * Math.max(effectiveRadius, bezel));
        const activeArea = Math.max(1, activeW * h);
        const budgetScale = Math.sqrt(MAP_MAX_PIXELS / activeArea);
        return Math.max(MAP_MIN_SCALE, Math.min(s, budgetScale));
    }

    function formatGlassFilterStyle(filterId, blurAmt, qualityTier) {
        if (PREBLUR_MODE === "css" && blurAmt > 0 && qualityTier < 2) {
            const effBlur = qualityTier === 1 ? (blurAmt * 0.5).toFixed(2) : blurAmt;
            return `blur(${effBlur}px) url(#${filterId})`;
        }
        return `url(#${filterId})`;
    }

    const opticalBasisCache = new Map();
    const MAX_OPTICAL_BASIS_ENTRIES = 8;
    const refractionProfileCache = new Map();
    const MAX_REFRACTION_PROFILE_ENTRIES = 16;

    function computeSnellRayRatio(derivative, oneMinusEta2, eta) {
        const p = derivative;
        if (p > 1e4) {
            return Math.sqrt(oneMinusEta2) / eta;
        }
        const p2 = p * p;
        const S = Math.sqrt(1 + oneMinusEta2 * p2);
        return ((S - eta) * p) / (S + eta * p2);
    }

    function getOpticalBasis(surfaceKey, ior = 2.05, samples = 128) {
        const isStandard = ior === 2.05 && samples === 128;
        const basisKey = isStandard ? surfaceKey : `${surfaceKey}_${ior}_${samples}`;
        const cached = opticalBasisCache.get(basisKey);
        if (cached) {
            return cached;
        }

        const eta = 1 / ior;
        const etaSquared = eta * eta;
        const oneMinusEta2 = 1 - etaSquared;
        const invSamplesMinus1 = 1 / (samples - 1);
        const evalFn = SURFACE_EVAL_FNS[surfaceKey] || SURFACE_EVAL_FNS.convex_squircle;

        const vectorA = new Float32Array(samples);
        const vectorB = new Float32Array(samples);
        const lastSampleIndex = samples - 1;

        for (let sampleIndex = 1; sampleIndex < lastSampleIndex; sampleIndex++) {
            const coordX = sampleIndex * invSamplesMinus1;
            evalFn(coordX);
            const height = SURFACE_EVAL_RESULT.height;
            const deriv = SURFACE_EVAL_RESULT.derivative;
            const ratio = computeSnellRayRatio(deriv, oneMinusEta2, eta);

            const hClamped = Math.max(0, height);
            const p2 = deriv * deriv;
            const fresnelFactor = 1 / Math.sqrt(Math.sqrt(1 + 0.12 * p2));
            const effRatio = ratio * fresnelFactor;
            vectorA[sampleIndex] = effRatio * hClamped;
            vectorB[sampleIndex] = effRatio * Math.sqrt(hClamped * Math.sqrt(hClamped));
        }

        const basisRecord = { vectorA, vectorB };
        if (opticalBasisCache.size >= MAX_OPTICAL_BASIS_ENTRIES) {
            const oldestKey = opticalBasisCache.keys().next().value;
            if (!SURFACE_EVAL_FNS[oldestKey]) {
                opticalBasisCache.delete(oldestKey);
            }
        }
        opticalBasisCache.set(basisKey, basisRecord);
        return basisRecord;
    }

    for (const surfaceKey of Object.keys(SURFACE_EVAL_FNS)) {
        getOpticalBasis(surfaceKey, 2.05, 128);
    }

    function getRefractionProfile(glassThickness, bezelWidth, heightFn, surfaceKey, ior = 2.05, samples = 128) {
        const isZeroBezel = bezelWidth <= 1e-6;
        const rho = isZeroBezel ? Infinity : glassThickness / bezelWidth;
        const rhoKey = Number.isFinite(rho) ? rho.toFixed(3) : "INF";
        const profileCacheKey = `${surfaceKey}_${rhoKey}_${ior}_${samples}`;

        let cached = refractionProfileCache.get(profileCacheKey);
        if (!cached) {
            const basis = getOpticalBasis(surfaceKey, ior, samples);
            const vectorA = basis.vectorA;
            const vectorB = basis.vectorB;

            const normProfile = new Float32Array(samples);
            let unitMax = 0;
            const lastSampleIndex = samples - 1;

            if (!Number.isFinite(rho)) {
                for (let sampleIndex = 1; sampleIndex < lastSampleIndex; sampleIndex++) {
                    const u = vectorB[sampleIndex];
                    normProfile[sampleIndex] = u;
                    const absU = Math.abs(u);
                    if (absU > unitMax) unitMax = absU;
                }
            } else {
                for (let sampleIndex = 1; sampleIndex < lastSampleIndex; sampleIndex++) {
                    const u = vectorA[sampleIndex] + rho * vectorB[sampleIndex];
                    normProfile[sampleIndex] = u;
                    const absU = Math.abs(u);
                    if (absU > unitMax) unitMax = absU;
                }
            }

            if (unitMax === 0) {
                unitMax = 1;
            }

            const profileNormScale = 127.0 / unitMax;
            for (let sampleIndex = 1; sampleIndex < lastSampleIndex; sampleIndex++) {
                normProfile[sampleIndex] *= profileNormScale;
            }
            normProfile.profileNormScale = 1.0;

            cached = {
                normProfile,
                unitMax,
                profileNormScale: 1.0,
                profileCacheKey,
            };

            if (refractionProfileCache.size >= MAX_REFRACTION_PROFILE_ENTRIES) {
                const oldestKey = refractionProfileCache.keys().next().value;
                refractionProfileCache.delete(oldestKey);
            }
            refractionProfileCache.set(profileCacheKey, cached);
        }

        const maxDispCalc = isZeroBezel ? glassThickness * cached.unitMax : bezelWidth * cached.unitMax;
        const maxDisplacement = maxDispCalc === 0 ? 1 : maxDispCalc;

        return {
            normProfile: cached.normProfile,
            maxDisplacement,
            profileCacheKey,
            profileNormScale: cached.profileNormScale,
        };
    }

    const GLASS_COLOR_MATRIX = `1.3937 -0.3576 -0.0361 0 0
                            -0.1063 1.1424 -0.0361 0 0
                            -0.1063 -0.3576 1.4639 0 0
                            0 0 0 1 0`;

    const geometryCache = new Map();
    const MAX_GEOMETRY_CACHE_ENTRIES = 12;
    const MAX_GEOMETRY_CACHE_BYTES = 6 * 1024 * 1024;
    let geometryCacheBytes = 0;

    let sharedRadialLutDisp = null;
    let sharedRadialLutDither = null;
    let sharedRadialLutCapacity = 0;

    function releaseSharedScratchArrays() {
        sharedRadialLutDisp = null;
        sharedRadialLutDither = null;
        sharedRadialLutCapacity = 0;
    }

    function createGlassGeometryCache(
        clampedRadius,
        bezelThickness,
        normProfile,
        axis = null,
        scaleFactor = 1.0,
        profileNormScale = (normProfile && normProfile.profileNormScale) || 1.0
    ) {
        const isXAxisOnly = axis === "x";
        const profileLength = normProfile.length;
        const maxProfileIndex = profileLength - 1;
        const inverseBezel = 1 / (bezelThickness || 1);
        const profileScale = maxProfileIndex * inverseBezel;

        const cornerSize = Math.max(1, Math.round(Math.max(clampedRadius, bezelThickness)));
        const topBezelLimit = Math.max(1, Math.ceil(bezelThickness) + 1);

        const pixelBuffer = new Uint32Array(isXAxisOnly ? topBezelLimit * 2 : topBezelLimit * 3);
        pixelBuffer.fill(GLASS_NEUTRAL_PIXEL);

        const topRowPixels = isXAxisOnly ? null : pixelBuffer.subarray(0, topBezelLimit);
        const leftColumnPixels = isXAxisOnly ? pixelBuffer.subarray(0, topBezelLimit) : pixelBuffer.subarray(topBezelLimit, topBezelLimit * 2);
        const rightColumnPixels = isXAxisOnly ? pixelBuffer.subarray(topBezelLimit, topBezelLimit * 2) : pixelBuffer.subarray(topBezelLimit * 2, topBezelLimit * 3);

        const effectiveBezelLimit = Math.min(topBezelLimit, Math.max(0, Math.ceil(bezelThickness - 0.5)));
        const fixedScale = ((maxProfileIndex << 16) * inverseBezel) | 0;
        let fixedIdx = fixedScale >> 1;
        for (let i = 0; i < effectiveBezelLimit; i++, fixedIdx += fixedScale) {
            const baseIndex = fixedIdx >> 16;
            const fracFixed = fixedIdx & 0xFFFF;
            const nextIndex = Math.min(baseIndex + 1, maxProfileIndex);
            const p0 = normProfile[baseIndex];
            const normalDisplacement = p0 + (fracFixed * (normProfile[nextIndex] - p0)) * (1 / 65536);

            const dither = Math.abs(normalDisplacement) > 1e-3 ? ign(i, 0) : 0;
            const deltaNorm = Math.max(-127, Math.min(127, Math.round(normalDisplacement + dither)));
            const rPos = 128 + deltaNorm;
            const rNeg = 128 - deltaNorm;

            if (!isXAxisOnly) {
                topRowPixels[i] = (0xFF800080 | (rPos << 8)) >>> 0;
            }
            const rightPixel = (0xFF008080 | (rNeg << 16)) >>> 0;
            leftColumnPixels[i] = (0xFF008080 | (rPos << 16)) >>> 0;
            rightColumnPixels[topBezelLimit - 1 - i] = rightPixel;
        }

        const circleRadius = Math.min(clampedRadius, cornerSize);
        const patchArea = cornerSize * cornerSize;

        const cornerPatchTL = new Uint32Array(patchArea);
        const cornerPatchTR = new Uint32Array(patchArea);

        cornerPatchTL.fill(GLASS_NEUTRAL_PIXEL);
        cornerPatchTR.fill(GLASS_NEUTRAL_PIXEL);

        const minCornerDist = Math.max(0, clampedRadius - bezelThickness);
        const minCornerDist2 = minCornerDist * minCornerDist;
        const clampedRadius2 = clampedRadius * clampedRadius;

        if (circleRadius > 0.5 && clampedRadius2 > minCornerDist2) {
            const RADIAL_LUT_STEPS_PER_PX = 32;
            const lutLength = Math.ceil(bezelThickness * RADIAL_LUT_STEPS_PER_PX) + 4;
            if (sharedRadialLutCapacity < lutLength) {
                sharedRadialLutCapacity = Math.max(lutLength, 256);
                sharedRadialLutDisp = new Float32Array(sharedRadialLutCapacity);
                sharedRadialLutDither = new Float32Array(sharedRadialLutCapacity);
            }
            const maxLutIndex = lutLength - 1;
            const invLutSteps = 1 / RADIAL_LUT_STEPS_PER_PX;

            for (let i = 0; i <= maxLutIndex; i++) {
                const d = i * invLutSteps;
                let coverageFactor = 1.0;
                if (d < 0.28) {
                    const t = Math.max(0, d) * (1 / 0.28);
                    coverageFactor = t * t * (3.0 - 2.0 * t);
                }

                const floatIdx = Math.max(0, Math.min(d * profileScale, maxProfileIndex));
                const baseIndex = floatIdx | 0;
                const fraction = floatIdx - baseIndex;
                const nextIndex = Math.min(baseIndex + 1, maxProfileIndex);
                const p0 = normProfile[baseIndex];
                const normalDisplacement = p0 + fraction * (normProfile[nextIndex] - p0);

                const sampleDist = clampedRadius - d;
                const invDist = sampleDist > 1e-6 ? 1.0 / sampleDist : 0.0;
                sharedRadialLutDisp[i] = normalDisplacement * coverageFactor * invDist;

                const edgeDither = Math.min(1.0, Math.max(0, d * 2.5));
                sharedRadialLutDither[i] = (Math.abs(normalDisplacement) > 1e-3) ? (INV_65536 * edgeDither) : 0.0;
            }

            let rowOffsetTL = 0;
            for (let cornerRow = 0; cornerRow < circleRadius; cornerRow++, rowOffsetTL += cornerSize) {
                const deltaY = clampedRadius - cornerRow - 0.5;
                const deltaY2 = deltaY * deltaY;
                if (deltaY2 >= clampedRadius2) continue;

                let colStart = cornerRow;
                const radDiff = clampedRadius2 - deltaY2;
                if (radDiff > 0) {
                    const maxDeltaX = Math.sqrt(radDiff);
                    colStart = Math.max(cornerRow, Math.ceil(clampedRadius - 0.5 - maxDeltaX + 1e-9));
                }

                let colEnd = circleRadius - 1;
                if (deltaY2 < minCornerDist2) {
                    const minDeltaX = Math.sqrt(minCornerDist2 - deltaY2);
                    colEnd = Math.min(circleRadius - 1, Math.floor(clampedRadius - 0.5 - minDeltaX - 1e-9));
                }
                if (colStart > colEnd) continue;

                const rFlip = cornerSize - 1 - cornerRow;

                for (let cornerCol = colStart; cornerCol <= colEnd; cornerCol++) {
                    const deltaX = clampedRadius - cornerCol - 0.5;
                    const dist2 = deltaX * deltaX + deltaY2;
                    if (dist2 >= clampedRadius2 || dist2 < minCornerDist2) continue;

                    const sampleDist = Math.sqrt(dist2);
                    const distanceToEdge = clampedRadius - sampleDist;
                    const lutIdx = Math.min(maxLutIndex, Math.max(0, (distanceToEdge * RADIAL_LUT_STEPS_PER_PX + 0.5) | 0));

                    const displacementFactor = sharedRadialLutDisp[lutIdx];
                    const vX = deltaX * displacementFactor;
                    const vY = deltaY * displacementFactor;

                    const cFlip = cornerSize - 1 - cornerCol;
                    const ditherScale = sharedRadialLutDither[lutIdx];

                    if (isXAxisOnly) {
                        let dither = 0;
                        let ditherB = 0;
                        if (ditherScale > 0) {
                            const h = hash32(cornerCol, cornerRow);
                            dither = ((h << 16) >> 16) * ditherScale;
                            if (cornerCol !== cornerRow) {
                                const hB = ((h >>> 16) | (h << 16)) ^ 0x55555555;
                                ditherB = ((hB << 16) >> 16) * ditherScale;
                            }
                        }

                        const deltaXNorm = Math.max(-127, Math.min(127, Math.round(vX + dither)));
                        const rPos = 128 + deltaXNorm;
                        const rNeg = 128 - deltaXNorm;

                        cornerPatchTL[rowOffsetTL + cornerCol] = (0xFF008080 | (rPos << 16)) >>> 0;
                        cornerPatchTR[rowOffsetTL + cFlip] = (0xFF008080 | (rNeg << 16)) >>> 0;

                        if (cornerCol !== cornerRow) {
                            const deltaXNormB = Math.max(-127, Math.min(127, Math.round(vY + ditherB)));
                            const rPosB = 128 + deltaXNormB;
                            const rNegB = 128 - deltaXNormB;
                            const tRowTL = cornerCol * cornerSize;

                            cornerPatchTL[tRowTL + cornerRow] = (0xFF008080 | (rPosB << 16)) >>> 0;
                            cornerPatchTR[tRowTL + rFlip] = (0xFF008080 | (rNegB << 16)) >>> 0;
                        }
                    } else {
                        let ditherX = 0, ditherY = 0;
                        let ditherXB = 0, ditherYB = 0;
                        if (ditherScale > 0) {
                            const h = hash32(cornerCol, cornerRow);
                            ditherX = ((h << 16) >> 16) * ditherScale;
                            ditherY = (h >> 16) * ditherScale;
                            if (cornerCol !== cornerRow) {
                                const hB = ((h >>> 16) | (h << 16)) ^ 0x55555555;
                                ditherXB = ((hB << 16) >> 16) * ditherScale;
                                ditherYB = (hB >> 16) * ditherScale;
                            }
                        }

                        const dX = Math.round(vX + ditherX);
                        const dY = Math.round(vY + ditherY);
                        const clampedDx = Math.max(-127, Math.min(127, dX));
                        const clampedDy = Math.max(-127, Math.min(127, dY));
                        const rPos = 128 + clampedDx;
                        const rNeg = 128 - clampedDx;
                        const gPos = 128 + clampedDy;

                        cornerPatchTL[rowOffsetTL + cornerCol] = (0xFF000080 | (rPos << 16) | (gPos << 8)) >>> 0;
                        cornerPatchTR[rowOffsetTL + cFlip] = (0xFF000080 | (rNeg << 16) | (gPos << 8)) >>> 0;

                        if (cornerCol !== cornerRow) {
                            const dXB = Math.round(vY + ditherXB);
                            const dYB = Math.round(vX + ditherYB);
                            const clampedDxB = Math.max(-127, Math.min(127, dXB));
                            const clampedDyB = Math.max(-127, Math.min(127, dYB));
                            const rPosB = 128 + clampedDxB;
                            const rNegB = 128 - clampedDxB;
                            const gPosB = 128 + clampedDyB;

                            const tRowTL = cornerCol * cornerSize;

                            cornerPatchTL[tRowTL + cornerRow] = (0xFF000080 | (rPosB << 16) | (gPosB << 8)) >>> 0;
                            cornerPatchTR[tRowTL + rFlip] = (0xFF000080 | (rNegB << 16) | (gPosB << 8)) >>> 0;
                        }
                    }
                }
            }
        }

        if (cornerSize > circleRadius) {
            const fillSpan = cornerSize - circleRadius;
            for (let r = 0; r < cornerSize; r++) {
                const rowOffsetTL = r * cornerSize;
                const topP = (topRowPixels && r < topRowPixels.length) ? topRowPixels[r] : GLASS_NEUTRAL_PIXEL;

                if (r < circleRadius) {
                    cornerPatchTL.fill(topP, rowOffsetTL + circleRadius, rowOffsetTL + cornerSize);
                    cornerPatchTR.fill(topP, rowOffsetTL, rowOffsetTL + fillSpan);
                } else {
                    const leftLimit = Math.min(r, leftColumnPixels.length);
                    for (let c = 0; c < leftLimit; c++) {
                        cornerPatchTL[rowOffsetTL + c] = leftColumnPixels[c];
                    }
                    const leftP = r < leftColumnPixels.length ? leftColumnPixels[r] : GLASS_NEUTRAL_PIXEL;
                    const vx = ((leftP >> 16) & 0xFF) - 128;
                    const vy = ((topP >> 8) & 0xFF) - 128;
                    const diagR = Math.max(1, Math.min(255, 128 + Math.round(vx * 0.7071)));
                    const diagG = Math.max(1, Math.min(255, 128 + Math.round(vy * 0.7071)));
                    cornerPatchTL[rowOffsetTL + r] = (0xFF000080 | (diagR << 16) | (diagG << 8)) >>> 0;
                    if (r + 1 < cornerSize) {
                        cornerPatchTL.fill(topP, rowOffsetTL + r + 1, rowOffsetTL + cornerSize);
                    }

                    for (let c = 0; c < cornerSize; c++) {
                        const tlPixel = cornerPatchTL[rowOffsetTL + c];
                        if (tlPixel === GLASS_NEUTRAL_PIXEL) continue;
                        const cFlip = cornerSize - 1 - c;
                        const rg = (tlPixel >> 8) & 0xFFFF;
                        const rVal = rg >> 8;
                        const gVal = rg & 0xFF;
                        const rNeg = Math.min(255, Math.max(0, 256 - rVal));

                        if (isXAxisOnly) {
                            cornerPatchTR[rowOffsetTL + cFlip] = (0xFF000080 | (rNeg << 16) | 0x8000) >>> 0;
                        } else {
                            cornerPatchTR[rowOffsetTL + cFlip] = (0xFF000080 | (rNeg << 16) | (gVal << 8)) >>> 0;
                        }
                    }
                }
            }
        }

        const bytes = pixelBuffer.byteLength + patchArea * 4 * 2;

        return {
            bytes,
            cornerSize,
            topBezelLimit,
            effectiveBezelLimit,
            topRowPixels,
            bottomRowPixels: null,
            leftColumnPixels,
            rightColumnPixels,
            rightColumnPixelsReversed: rightColumnPixels,
            cornerPatchTL,
            cornerPatchTR,
            cornerPatchBL: null,
            cornerPatchBR: null,
        };
    }

    function evictGeometryCache(incomingBytes = 0) {
        while (
            geometryCache.size > 0 &&
            (geometryCache.size >= MAX_GEOMETRY_CACHE_ENTRIES ||
                geometryCacheBytes + incomingBytes > MAX_GEOMETRY_CACHE_BYTES)
        ) {
            const oldestKey = geometryCache.keys().next().value;
            const oldest = geometryCache.get(oldestKey);
            geometryCacheBytes = Math.max(0, geometryCacheBytes - (oldest && oldest.bytes ? oldest.bytes : 0));
            geometryCache.delete(oldestKey);
        }
    }

    function renderDisplacementMapToBuffer(
        destinationU32,
        targetWidth,
        targetHeight,
        radius,
        bezelWidth,
        normProfile,
        scaleFactor = 1.0,
        profileCacheKey = "",
        axis = null,
        isPill = false,
        profileNormScale = (normProfile && normProfile.profileNormScale) || 1.0
    ) {
        const halfWidth = targetWidth * 0.5;
        const halfHeight = targetHeight * 0.5;
        const maxRadius = Math.min(Math.floor(halfWidth), Math.floor(halfHeight));
        const scaledBezel = Math.max(1, bezelWidth * scaleFactor);

        const pillMode = Boolean(isPill || (radius * scaleFactor >= maxRadius - 0.5));
        const geomRadius = pillMode ? maxRadius : Math.min(Math.round(Math.max(radius * scaleFactor, 0)), maxRadius);

        const geometryKey = `${profileCacheKey}_${geomRadius}_${scaledBezel.toFixed(2)}_${axis || ""}`;
        let geometry = geometryCache.get(geometryKey);
        if (!geometry) {
            geometry = createGlassGeometryCache(geomRadius, scaledBezel, normProfile, axis, scaleFactor, profileNormScale);
            evictGeometryCache(geometry.bytes);
            geometryCache.set(geometryKey, geometry);
            geometryCacheBytes += geometry.bytes;
        }

        const geomCornerSize = geometry.cornerSize;
        const cornerSize = Math.min(geomCornerSize, Math.floor(halfWidth), Math.floor(halfHeight));
        const straightXStart = cornerSize;
        const straightXEnd = targetWidth - straightXStart;
        const effectiveBezel = geometry.effectiveBezelLimit ?? geometry.topBezelLimit;
        const actualRowBezelLimit = Math.min(effectiveBezel, Math.ceil(halfHeight));
        const actualColBezelLimit = Math.min(effectiveBezel, Math.ceil(halfWidth));
        const horizontalBezelLimit = Math.min(actualRowBezelLimit, cornerSize);


        const patchTL = geometry.cornerPatchTL;
        const patchTR = geometry.cornerPatchTR;
        const topRowPixels = geometry.topRowPixels;

        const isXAxisOnly = axis === "x";

        let rowOffset = 0;
        let patchOffset = 0;
        for (let r = 0; r < cornerSize; r++, rowOffset += targetWidth, patchOffset += geomCornerSize) {
            for (let c = 0; c < cornerSize; c++) {
                destinationU32[rowOffset + c] = patchTL[patchOffset + c];
                destinationU32[rowOffset + straightXEnd + c] = patchTR[patchOffset + c];
            }

            if (straightXStart < straightXEnd) {
                const topPixel = (topRowPixels && r < horizontalBezelLimit) ? topRowPixels[r] : GLASS_NEUTRAL_PIXEL;
                destinationU32.fill(topPixel, rowOffset + straightXStart, rowOffset + straightXEnd);
            }
        }

        const interiorStartRow = cornerSize;
        const interiorEndRow = targetHeight - cornerSize;

        if (interiorEndRow > interiorStartRow) {
            const templateOffset = interiorStartRow * targetWidth;
            destinationU32.fill(GLASS_NEUTRAL_PIXEL, templateOffset, templateOffset + targetWidth);

            if (actualColBezelLimit > 0) {
                const leftPixels = geometry.leftColumnPixels;
                const rightPixels = geometry.rightColumnPixels;
                const rightEdgeOffset = targetWidth - actualColBezelLimit;
                const rightStartIndex = geometry.topBezelLimit - actualColBezelLimit;
                for (let c = 0; c < actualColBezelLimit; c++) {
                    destinationU32[templateOffset + c] = leftPixels[c];
                    destinationU32[templateOffset + rightEdgeOffset + c] = rightPixels[rightStartIndex + c];
                }
            }

            const interiorLimitOffset = interiorEndRow * targetWidth;
            let writeOffset = templateOffset + targetWidth;
            while (writeOffset < interiorLimitOffset) {
                const chunkSize = Math.min(writeOffset - templateOffset, interiorLimitOffset - writeOffset);
                destinationU32.copyWithin(writeOffset, templateOffset, templateOffset + chunkSize);
                writeOffset += chunkSize;
            }
        }

        if (isXAxisOnly) {
            for (let r = 0; r < cornerSize; r++) {
                const srcOffset = r * targetWidth;
                const dstOffset = (targetHeight - 1 - r) * targetWidth;
                destinationU32.copyWithin(dstOffset, srcOffset, srcOffset + targetWidth);
            }
        } else {
            for (let r = 0; r < cornerSize; r++) {
                const srcOffset = r * targetWidth;
                const dstOffset = (targetHeight - 1 - r) * targetWidth;
                for (let c = 0; c < cornerSize; c++) {
                    const pTL = destinationU32[srcOffset + c];
                    destinationU32[dstOffset + c] = ((pTL & 0xFFFF00FF) | ((0x00010000 - (pTL & 0x0000FF00)) & 0x0000FF00)) >>> 0;
                    const pTR = destinationU32[srcOffset + straightXEnd + c];
                    destinationU32[dstOffset + straightXEnd + c] = ((pTR & 0xFFFF00FF) | ((0x00010000 - (pTR & 0x0000FF00)) & 0x0000FF00)) >>> 0;
                }

                if (straightXStart < straightXEnd) {
                    const topPixel = (topRowPixels && r < horizontalBezelLimit) ? topRowPixels[r] : GLASS_NEUTRAL_PIXEL;
                    const bottomPixel = ((topPixel & 0xFFFF00FF) | ((0x00010000 - (topPixel & 0x0000FF00)) & 0x0000FF00)) >>> 0;
                    destinationU32.fill(bottomPixel, dstOffset + straightXStart, dstOffset + straightXEnd);
                }
            }
        }
    }

    const SWITCH_ACTIVE_TARGET = {
        id: "switch-liquid-glass-filter-active",
        surfaceKey: "convex_squircle",
        axis: "x",
        isPill: true,
        glassThickness: 32,
        maxBezel: 11,
        scaleRatio: 1.1,
        blurAmt: 0,
        postBlur: 0,
        colorMatrix: GLASS_COLOR_MATRIX,
        alwaysOn: true,
    };

    const BADGE_GLASS_TARGET = {
        id: "badge-liquid-glass-filter",
        selector: ".badge-liquid-card",
        surfaceKey: "convex_squircle",
        glassThickness: 42,
        maxBezel: 10,
        scaleRatio: 1.12,
        blurAmt: 1.0,
        postBlur: 0.4,
        colorMatrix: GLASS_COLOR_MATRIX,
        coreFilter: "blur(14px) saturate(140%)",
        radius: 18,
        isPill: false,
        alwaysOn: false,
    };

    const GLASS_TARGETS = [
        {
            id: "liquid-glass-filter",
            selector: '[data-liquid-glass="nav"], .navbar',
            surfaceKey: "convex_squircle",
            glassThickness: 75,
            maxBezel: 22,
            scaleRatio: 1.35,
            maxScaleMultiplier: 3.2,
            blurAmt: 2.5,
            postBlur: 0.6,
            colorMatrix: GLASS_COLOR_MATRIX,
            coreFilter: "blur(18px) saturate(180%)",
            isPill: true,
            alwaysOn: true,
        },
        BADGE_GLASS_TARGET,
        {
            id: "switch-liquid-glass-filter",
            selector: ".lang-toggle-glider",
            surfaceKey: "convex_squircle",
            axis: "x",
            isPill: true,
            alwaysOn: true,
            glassThickness: 24,
            maxBezel: 9,
            scaleRatio: 0.5,
            blurAmt: 0,
            postBlur: 0,
            colorMatrix: GLASS_COLOR_MATRIX,
            activeConfig: SWITCH_ACTIVE_TARGET,
        },
    ];

    const MAX_ELEMENT_DEVICE_AREA = 1_500_000;
    const MAX_TOTAL_DEVICE_AREA = 4_000_000;
    const CSS_FALLBACK_BACKDROP = "blur(16px) saturate(140%)";

    let currentTotalDeviceArea = 0;
    const warnedAreaExceededElements = new WeakSet();

    let isScrolling = false;
    let scrollIdleTimer = null;

    function handleScrollState() {
        startGovernor();
        if (!LIGHT_TIER_ON_SCROLL) return;
        if (!isScrolling) {
            isScrolling = true;
            applyQualityTier(1);
        }
        if (scrollIdleTimer !== null) clearTimeout(scrollIdleTimer);
        scrollIdleTimer = setTimeout(onScrollEnd, 120);
    }

    function onScrollEnd() {
        if (scrollIdleTimer !== null) {
            clearTimeout(scrollIdleTimer);
            scrollIdleTimer = null;
        }
        if (isScrolling) {
            isScrolling = false;
            if (LIGHT_TIER_ON_SCROLL) {
                applyQualityTier(0);
            }
        }
        stopGovernor();
    }

    let filterIdCounter = 0;
    const elementStateMap = new WeakMap();
    const activeElements = new Set();
    const dirtyElements = new Set();
    const warnedFailedElements = new WeakSet();
    let sharedResizeObserver = null;
    let sharedIntersectionObserver = null;

    let isLiquidGlassDowngraded = false;
    let qualityDowngradeCount = 0;
    let qualityUpgradeCount = 0;
    let currentQualityTier = 0;

    let lastKnownDpr = 1;

    const debugMaps = {};

    const MAX_LRU_FILTERS = 2;
    const BLOB_REVOKE_DELAY_MS = 1000;
    const LRU_IDLE_EVICT_MS = 5000;
    let lruEvictionTimer = null;

    const sharedFilters = new Map();
    const lruUnusedFilterKeys = new Set();

    let activeBlobUrlCount = 0;
    let acquireCountMinute = 0;
    let acquireCountWindowStart = 0;

    const BMP_HEADER_OFFSET = 56;
    const STATIC_BMP_INITIAL_CAPACITY = 262144;
    let sharedScratchBmpBuffer = new ArrayBuffer(STATIC_BMP_INITIAL_CAPACITY);
    let sharedScratchBmpCapacity = STATIC_BMP_INITIAL_CAPACITY;
    let sharedScratchBmpView = new DataView(sharedScratchBmpBuffer);

    function initStaticBmpHeader(view) {
        view.setUint16(0, 0x4D42, true);
        view.setUint32(6, 0, true);
        view.setUint32(10, BMP_HEADER_OFFSET, true);
        view.setUint32(14, 40, true);
        view.setUint16(26, 1, true);
        view.setUint16(28, 32, true);
        view.setUint32(30, 0, true);
        view.setInt32(38, 2835, true);
        view.setInt32(42, 2835, true);
        view.setUint32(46, 0, true);
        view.setUint32(50, 0, true);
        view.setUint16(54, 0, true);
    }
    initStaticBmpHeader(sharedScratchBmpView);

    function scheduleLruEviction(delay = LRU_IDLE_EVICT_MS) {
        if (lruEvictionTimer !== null) return;
        lruEvictionTimer = setTimeout(processLruEviction, delay);
    }

    function processLruEviction() {
        lruEvictionTimer = null;
        const now = performance.now();
        let nextDelay = LRU_IDLE_EVICT_MS;
        for (const key of lruUnusedFilterKeys) {
            const record = sharedFilters.get(key);
            if (!record) {
                lruUnusedFilterKeys.delete(key);
                continue;
            }
            if (record.refCount <= 0) {
                const idleTime = now - record.lastUsed;
                if (idleTime >= LRU_IDLE_EVICT_MS) {
                    disposeSharedFilter(key, false);
                } else {
                    nextDelay = Math.max(50, LRU_IDLE_EVICT_MS - idleTime);
                    break;
                }
            }
        }
        if (lruUnusedFilterKeys.size > 0) {
            scheduleLruEviction(nextDelay);
        }
    }

    function getSharedBmpBuffer(targetWidth, targetHeight) {
        const offset = BMP_HEADER_OFFSET;
        const pixelCount = targetWidth * targetHeight;
        const pixelBytes = pixelCount << 2;
        const requiredFileSize = offset + pixelBytes;

        if (sharedScratchBmpCapacity < requiredFileSize) {
            let nextCapacity = Math.max(requiredFileSize, sharedScratchBmpCapacity * 2);
            sharedScratchBmpBuffer = new ArrayBuffer(nextCapacity);
            sharedScratchBmpCapacity = nextCapacity;
            sharedScratchBmpView = new DataView(sharedScratchBmpBuffer);
            initStaticBmpHeader(sharedScratchBmpView);
        }

        sharedScratchBmpView.setUint32(2, requiredFileSize, true);
        sharedScratchBmpView.setInt32(18, targetWidth, true);
        sharedScratchBmpView.setInt32(22, -targetHeight, true);
        sharedScratchBmpView.setUint32(34, pixelBytes, true);

        const u32 = new Uint32Array(sharedScratchBmpBuffer, offset, pixelCount);
        const fileView = new Uint8Array(sharedScratchBmpBuffer, 0, requiredFileSize);
        return { buffer: fileView, u32 };
    }

    function releaseSharedScratchBmpBuffer() {
        if (sharedScratchBmpCapacity > STATIC_BMP_INITIAL_CAPACITY) {
            sharedScratchBmpBuffer = new ArrayBuffer(STATIC_BMP_INITIAL_CAPACITY);
            sharedScratchBmpCapacity = STATIC_BMP_INITIAL_CAPACITY;
            sharedScratchBmpView = new DataView(sharedScratchBmpBuffer);
            initStaticBmpHeader(sharedScratchBmpView);
        }
    }

    function disposeSharedFilter(key, immediate = false) {
        if (!key) return;
        const record = sharedFilters.get(key);
        if (!record) return;

        if (record.node && record.node.parentNode) {
            record.node.remove();
        }
        if (record.nodeT1 && record.nodeT1.parentNode) {
            record.nodeT1.remove();
        }
        record.node = null;
        record.nodeT1 = null;
        record.feImage = null;
        record.feImageT1 = null;

        record.preloadImage = null;
        const blobToRevoke = record.blobUrl;
        if (blobToRevoke && blobToRevoke.startsWith("blob:")) {
            if (immediate) {
                URL.revokeObjectURL(blobToRevoke);
                activeBlobUrlCount = Math.max(0, activeBlobUrlCount - 1);
            } else {
                setTimeout(() => {
                    URL.revokeObjectURL(blobToRevoke);
                    activeBlobUrlCount = Math.max(0, activeBlobUrlCount - 1);
                }, BLOB_REVOKE_DELAY_MS);
            }
        }

        sharedFilters.delete(key);
        lruUnusedFilterKeys.delete(key);
    }

    function releaseSharedFilter(key, expectedRecord = null) {
        if (!key) return;
        const record = sharedFilters.get(key);
        if (!record) return;
        if (expectedRecord && record !== expectedRecord) return;
        record.refCount--;
        if (record.refCount <= 0) {
            record.refCount = 0;
            record.lastUsed = performance.now();
            lruUnusedFilterKeys.delete(key);
            lruUnusedFilterKeys.add(key);
            while (lruUnusedFilterKeys.size > MAX_LRU_FILTERS) {
                const evictKey = lruUnusedFilterKeys.keys().next().value;
                disposeSharedFilter(evictKey, false);
            }
            scheduleLruEviction();
        }
    }

    function startMapPreload(record) {
        if (record.ready) return Promise.resolve();
        if (record.readyPromise) return record.readyPromise;

        if (typeof Image === "undefined" || !record.blobUrl) {
            record.ready = true;
            return Promise.resolve();
        }

        const img = new Image();
        record.preloadImage = img;
        img.src = record.blobUrl;

        let timeoutId = null;
        const cleanup = () => {
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            record.ready = true;
            record.preloadImage = null;
        };

        const decodePromise = (typeof img.decode === "function")
            ? img.decode().then(cleanup).catch(cleanup)
            : new Promise((resolve) => {
                img.onload = img.onerror = () => {
                    cleanup();
                    resolve();
                };
            });

        const timeoutPromise = new Promise((resolve) => {
            timeoutId = setTimeout(() => {
                cleanup();
                resolve();
            }, MAP_PRELOAD_TIMEOUT_MS);
        });

        record.readyPromise = Promise.race([decodePromise, timeoutPromise]);
        return record.readyPromise;
    }

    const SVG_NS = "http://www.w3.org/2000/svg";

    function buildFilterElement(id, filterX, filterY, filterW, filterH, combinedUrl, w, h, scale, colorMatrix, blurAmt, isT1 = false) {

        const filterNode = document.createElementNS(SVG_NS, "filter");
        filterNode.id = id;
        filterNode.setAttribute("x", filterX);
        filterNode.setAttribute("y", filterY);
        filterNode.setAttribute("width", filterW);
        filterNode.setAttribute("height", filterH);
        filterNode.setAttribute("color-interpolation-filters", "sRGB");

        let dispMapIn = "SourceGraphic";
        if (PREBLUR_MODE === "svg" && blurAmt > 0) {
            const blurNode = document.createElementNS(SVG_NS, "feGaussianBlur");
            blurNode.setAttribute("in", "SourceGraphic");
            blurNode.setAttribute("stdDeviation", String(blurAmt));
            if (BLUR_EDGE_MODE !== "none") {
                blurNode.setAttribute("edgeMode", BLUR_EDGE_MODE);
            }
            const blurResult = isT1 ? "blurred_source_t1" : "blurred_source";
            blurNode.setAttribute("result", blurResult);
            filterNode.appendChild(blurNode);
            dispMapIn = blurResult;
        }

        const feImage = document.createElementNS(SVG_NS, "feImage");
        feImage.setAttribute("href", combinedUrl);
        feImage.setAttribute("preserveAspectRatio", "none");
        feImage.setAttribute("x", "0");
        feImage.setAttribute("y", "0");
        feImage.setAttribute("width", String(w));
        feImage.setAttribute("height", String(h));
        const dispMapResult = isT1 ? "disp_map_t1" : "disp_map";
        feImage.setAttribute("result", dispMapResult);
        filterNode.appendChild(feImage);

        const biasMatrix = document.createElementNS(SVG_NS, "feColorMatrix");
        biasMatrix.setAttribute("in", dispMapResult);
        biasMatrix.setAttribute("type", "matrix");
        const neutralShift = (-0.5 / 255).toFixed(8);
        biasMatrix.setAttribute("values", `1 0 0 0 ${neutralShift}
0 1 0 0 ${neutralShift}
0 0 1 0 0
0 0 0 1 0`);
        const unbiasedResult = isT1 ? "disp_map_unbiased_t1" : "disp_map_unbiased";
        biasMatrix.setAttribute("result", unbiasedResult);
        filterNode.appendChild(biasMatrix);

        const feDisp = document.createElementNS(SVG_NS, "feDisplacementMap");
        feDisp.setAttribute("in", dispMapIn);
        feDisp.setAttribute("in2", unbiasedResult);
        feDisp.setAttribute("scale", scale);
        feDisp.setAttribute("xChannelSelector", "R");
        feDisp.setAttribute("yChannelSelector", "G");
        const dispResult = isT1 ? "displaced_t1" : "displaced";
        feDisp.setAttribute("result", dispResult);
        filterNode.appendChild(feDisp);

        if (colorMatrix) {
            const feColor = document.createElementNS(SVG_NS, "feColorMatrix");
            feColor.setAttribute("in", dispResult);
            feColor.setAttribute("type", "matrix");
            feColor.setAttribute("values", colorMatrix);
            filterNode.appendChild(feColor);
        }

        return { filterNode, feImage };
    }

    function acquireSharedFilter(options) {
        const {
            sharedKey,
            targetConfig,
            w,
            h,
            actualW = w,
            actualH = h,
            radius,
            surfaceKey,
            rasterScale,
            halfMinDim,
            svgDefs,
        } = options;

        const now = performance.now();
        if (now - acquireCountWindowStart > 60000) {
            acquireCountMinute = 0;
            acquireCountWindowStart = now;
        }
        acquireCountMinute++;

        if (sharedFilters.has(sharedKey)) {
            const record = sharedFilters.get(sharedKey);
            if (record.refCount >= 1 && record.actualW !== undefined && (record.actualW !== actualW || record.actualH !== actualH)) {
                const exactKey = `${sharedKey}_${actualW}x${actualH}`;
                return acquireSharedFilter({
                    ...options,
                    sharedKey: exactKey,
                });
            }
            lruUnusedFilterKeys.delete(sharedKey);
            record.refCount++;
            record.lastUsed = now;
            if (record.node && !record.node.parentNode && svgDefs) {
                svgDefs.appendChild(record.node);
            }
            if (record.nodeT1 && !record.nodeT1.parentNode && svgDefs) {
                svgDefs.appendChild(record.nodeT1);
            }
            return record;
        }

        const glassThickness = targetConfig.glassThickness;
        const clampedBezel = Math.max(1, Math.min(targetConfig.maxBezel, halfMinDim - 1));
        const ior = 2.05;
        const scaleRatio = targetConfig.scaleRatio;
        const blurAmt = targetConfig.blurAmt;
        const postBlur = 0;

        const heightFn = SURFACE_FNS[surfaceKey] || SURFACE_FNS.convex_squircle;
        const refractionData = getRefractionProfile(glassThickness, clampedBezel, heightFn, surfaceKey, ior, 128);
        const { normProfile, maxDisplacement, profileCacheKey, profileNormScale } = refractionData;

        const s = currentQualityTier === 2
            ? Math.max(MAP_MIN_SCALE, pickMapScale(w, h, rasterScale, clampedBezel, radius, blurAmt) * 0.5)
            : pickMapScale(w, h, rasterScale, clampedBezel, radius, blurAmt);
        let targetW = Math.max(16, Math.round(w * s));
        targetW = (targetW + 15) & ~15;
        const effectiveScale = targetW / w;
        let targetH = targetConfig.axis === "x"
            ? 1
            : Math.max(2, 2 * Math.round((h * effectiveScale) / 2));

        const { buffer, u32 } = getSharedBmpBuffer(targetW, targetH);

        renderDisplacementMapToBuffer(
            u32,
            targetW,
            targetH,
            radius,
            clampedBezel,
            normProfile,
            effectiveScale,
            profileCacheKey,
            targetConfig.axis || null,
            Boolean(targetConfig.isPill),
            profileNormScale
        );

        const blob = new Blob([buffer], { type: "image/bmp" });
        const combinedUrl = URL.createObjectURL(blob);
        activeBlobUrlCount++;
        const rawScale = maxDisplacement * scaleRatio;
        const maxScaleMultiplier = targetConfig.maxScaleMultiplier ?? 4.0;
        const maxScale = maxScaleMultiplier * clampedBezel;
        const scale = Math.min(rawScale, maxScale).toFixed(2);

        filterIdCounter++;
        const filterId = `lg-${filterIdCounter}`;
        const filterIdT1 = `lg-${filterIdCounter}-t1`;

        const padPx = (PREBLUR_MODE === "svg" && blurAmt > 0) ? Math.ceil(3 * blurAmt) : 0;
        const filterX = padPx === 0 ? "0%" : `-${((padPx / w) * 100).toFixed(2)}%`;
        const filterY = padPx === 0 ? "0%" : `-${((padPx / h) * 100).toFixed(2)}%`;
        const filterW = padPx === 0 ? "100%" : `${(100 + (2 * padPx / w) * 100).toFixed(2)}%`;
        const filterH = padPx === 0 ? "100%" : `${(100 + (2 * padPx / h) * 100).toFixed(2)}%`;

        const { filterNode, feImage } = buildFilterElement(
            filterId, filterX, filterY, filterW, filterH, combinedUrl, actualW, actualH, scale, targetConfig.colorMatrix, blurAmt, false
        );
        svgDefs.appendChild(filterNode);

        const blurAmtT1 = (blurAmt * 0.5).toFixed(2);
        const padPxT1 = (PREBLUR_MODE === "svg" && blurAmt > 0) ? Math.ceil(1.5 * blurAmt) : 0;
        const filterXT1 = padPxT1 === 0 ? "0%" : `-${((padPxT1 / w) * 100).toFixed(2)}%`;
        const filterYT1 = padPxT1 === 0 ? "0%" : `-${((padPxT1 / h) * 100).toFixed(2)}%`;
        const filterWT1 = padPxT1 === 0 ? "100%" : `${(100 + (2 * padPxT1 / w) * 100).toFixed(2)}%`;
        const filterHT1 = padPxT1 === 0 ? "100%" : `${(100 + (2 * padPxT1 / h) * 100).toFixed(2)}%`;
        const t1Result = buildFilterElement(
            filterIdT1, filterXT1, filterYT1, filterWT1, filterHT1, combinedUrl, actualW, actualH, scale, targetConfig.colorMatrix, blurAmtT1, true
        );
        const filterNodeT1 = t1Result.filterNode;
        const feImageT1 = t1Result.feImage;
        svgDefs.appendChild(filterNodeT1);

        debugMaps[targetConfig.id] = `${targetW}x${targetH} @${effectiveScale.toFixed(2)}x (element ${w}x${h})`;

        const newRecord = {
            key: sharedKey,
            filterId,
            filterIdT1,
            node: filterNode,
            nodeT1: filterNodeT1,
            feImage,
            feImageT1,
            refCount: 1,
            blobUrl: combinedUrl,
            lastUsed: now,
            ready: false,
            readyPromise: null,
            preloadImage: null,
            actualW,
            actualH,
            lastFeW: actualW,
            lastFeH: actualH,
        };
        startMapPreload(newRecord);
        sharedFilters.set(sharedKey, newRecord);
        return newRecord;
    }

    function applyQualityTier(tier) {
        if (currentQualityTier === tier) return;
        const prevTier = currentQualityTier;
        if (tier < currentQualityTier) {
            qualityUpgradeCount++;
        } else {
            qualityDowngradeCount++;
        }
        currentQualityTier = tier;

        if (tier === 2 || prevTier === 2) {
            for (const element of activeElements) {
                dirtyElements.add(element);
            }
            flushDirtyElements();
            return;
        }

        for (const element of activeElements) {
            const state = elementStateMap.get(element);
            if (!state || !state.sharedKey) continue;
            const record = sharedFilters.get(state.sharedKey);
            if (!record) continue;
            const targetId = (currentQualityTier >= 1 && record.filterIdT1) ? record.filterIdT1 : record.filterId;
            if (state.activeSharedKey) {
                const activeRecord = sharedFilters.get(state.activeSharedKey);
                const activeTargetId = (currentQualityTier >= 1 && activeRecord?.filterIdT1) ? activeRecord.filterIdT1 : (activeRecord?.filterId || "");
                element.style.setProperty("--lg-filter-rest", `url(#${targetId})`);
                if (activeTargetId) {
                    element.style.setProperty("--lg-filter-active", `url(#${activeTargetId})`);
                }
            } else {
                const blurAmt = state.targetConfig?.blurAmt || 0;
                element.style.setProperty("--lg-filter", formatGlassFilterStyle(targetId, blurAmt, currentQualityTier));
            }
        }
    }

    function getElementState(element, targetConfig) {
        let state = elementStateMap.get(element);
        if (!state) {
            state = {
                targetConfig,
                sharedKey: null,
                activeSharedKey: null,
                pendingKey: null,
                activePendingKey: null,
                commitToken: 0,
                lastW: 0,
                lastH: 0,
                deviceArea: 0,
                observedW: 0,
                observedH: 0,
                cachedRadiusStr: null,
                appliedRadius: null,
                appliedInnerRadius: null,
                isIntersecting: Boolean(targetConfig.alwaysOn),
                rejectionReason: null,
            };
            elementStateMap.set(element, state);
        }
        return state;
    }

    function cancelPendingCommit(state) {
        state.commitToken++;
        state.pendingKey = null;
        state.activePendingKey = null;
    }

    function detachElementFilter(element, state) {
        if (!state) return;

        cancelPendingCommit(state);

        if (state.sharedKey) {
            const keyToRelease = state.sharedKey;
            state.sharedKey = null;
            releaseSharedFilter(keyToRelease);
        }

        if (state.activeSharedKey) {
            const keyToRelease = state.activeSharedKey;
            state.activeSharedKey = null;
            releaseSharedFilter(keyToRelease);
        }

        if (state.deviceArea) {
            currentTotalDeviceArea = Math.max(0, currentTotalDeviceArea - state.deviceArea);
            state.deviceArea = 0;
        }

        element.classList.remove("lg-on");
        element.classList.remove("lg-hollow");
        element.style.removeProperty("--lg-filter");
        element.style.removeProperty("--lg-filter-rest");
        element.style.removeProperty("--lg-filter-active");
        element.style.removeProperty("--lg-bezel");
        element.style.removeProperty("--lg-radius");
        element.style.removeProperty("--lg-inner-radius");
        element.style.removeProperty("--lg-core-filter");
        state.appliedFilterVal = null;
        state.appliedRestVal = null;
        state.appliedActiveVal = null;
        state.appliedBezel = null;
        state.appliedRadius = null;
        state.appliedInnerRadius = null;
        state.appliedCoreFilter = null;
        state.isHollow = false;
        activeElements.delete(element);
    }

    function applyCssFallback(element, state, reason) {
        if (!state) return;
        state.rejectionReason = reason;
        cancelPendingCommit(state);

        if (state.sharedKey) {
            const keyToRelease = state.sharedKey;
            state.sharedKey = null;
            releaseSharedFilter(keyToRelease);
        }

        if (state.activeSharedKey) {
            const keyToRelease = state.activeSharedKey;
            state.activeSharedKey = null;
            releaseSharedFilter(keyToRelease);
        }

        if (state.deviceArea) {
            currentTotalDeviceArea = Math.max(0, currentTotalDeviceArea - state.deviceArea);
            state.deviceArea = 0;
        }

        element.classList.remove("lg-hollow");
        element.style.removeProperty("--lg-bezel");
        element.style.removeProperty("--lg-radius");
        element.style.removeProperty("--lg-inner-radius");
        element.style.removeProperty("--lg-core-filter");
        element.style.removeProperty("--lg-filter-rest");
        element.style.removeProperty("--lg-filter-active");
        state.appliedRestVal = null;
        state.appliedActiveVal = null;
        state.appliedBezel = null;
        state.appliedRadius = null;
        state.appliedInnerRadius = null;
        state.appliedCoreFilter = null;
        state.isHollow = false;
        if (reason === "too_small") {
            element.classList.remove("lg-on");
            element.style.removeProperty("--lg-filter");
            state.appliedFilterVal = null;
            activeElements.delete(element);
        } else {
            element.style.setProperty("--lg-filter", CSS_FALLBACK_BACKDROP);
            state.appliedFilterVal = CSS_FALLBACK_BACKDROP;
            element.classList.add("lg-on");
            activeElements.add(element);
        }
    }

    function cleanupElementState(element) {
        const state = elementStateMap.get(element);
        if (!state) return;

        detachElementFilter(element, state);

        state.lastW = 0;
        state.lastH = 0;
        state.observedW = 0;
        state.observedH = 0;
        state.cachedRadiusStr = null;
        state.rejectionReason = null;

        dirtyElements.delete(element);
        activeElements.delete(element);

        if (sharedResizeObserver) {
            sharedResizeObserver.unobserve(element);
        }
        if (sharedIntersectionObserver) {
            sharedIntersectionObserver.unobserve(element);
        }
        if (badgeAnimationObserver) {
            badgeAnimationObserver.unobserve(element);
        }
    }

    function cleanupAllTargetStates() {
        if (intersectionFlushRafId !== null) {
            cancelAnimationFrame(intersectionFlushRafId);
            intersectionFlushRafId = null;
        }
        Array.from(activeElements).forEach((element) => {
            cleanupElementState(element);
        });
        activeElements.clear();

        const allKeys = Array.from(sharedFilters.keys());
        for (let i = 0; i < allKeys.length; i++) {
            disposeSharedFilter(allKeys[i], true);
        }
        lruUnusedFilterKeys.clear();
        currentTotalDeviceArea = 0;
        cachedSvgDefs = null;
    }

    let isBatteryLow = false;
    if (typeof navigator.getBattery === "function") {
        navigator.getBattery().then((battery) => {
            const updateBattery = () => {
                let nextLow = isBatteryLow;
                if (battery.charging) {
                    nextLow = false;
                } else if (battery.level <= 0.15) {
                    nextLow = true;
                } else if (battery.level >= 0.25) {
                    nextLow = false;
                }
                if (nextLow !== isBatteryLow) {
                    isBatteryLow = nextLow;
                    rebuildAllLiquidGlassFilters();
                }
            };
            updateBattery();
            battery.addEventListener("chargingchange", updateBattery);
            battery.addEventListener("levelchange", updateBattery);
        }).catch(() => { });
    }

    function onWindowResizeCheckDpr() {
        const dpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
        if (Math.abs(dpr - lastKnownDpr) <= 0.01) return;
        startGovernor();
        lastKnownDpr = dpr;
        scheduleRebuildLiquidGlass();
    }

    function detectDevicePerformance() {
        if (typeof window === "undefined") return;

        const concurrency = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 4;
        const memory = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 8;
        const isSaveData = Boolean(navigator.connection && navigator.connection.saveData);

        if ((concurrency <= 2 && memory <= 2) || isSaveData) {
            isLiquidGlassDowngraded = true;
            document.documentElement.classList.add("low-end-device");
        }
    }

    function downgradeLiquidGlassToCss() {
        if (isLiquidGlassDowngraded) return;
        isLiquidGlassDowngraded = true;
        detachGlobalListeners();
        stopGovernor();
        qualityDowngradeCount++;

        document.documentElement.classList.remove("liquid-glass-enabled");
        document.documentElement.classList.add("low-end-device");
        cleanupAllTargetStates();

        if (sharedResizeObserver) {
            sharedResizeObserver.disconnect();
            sharedResizeObserver = null;
        }
        if (sharedIntersectionObserver) {
            sharedIntersectionObserver.disconnect();
            sharedIntersectionObserver = null;
        }
        if (badgeAnimationObserver) {
            badgeAnimationObserver.disconnect();
            badgeAnimationObserver = null;
        }
    }

    function isChromiumBrowser() {
        if (typeof navigator === "undefined") return false;
        const userAgentData = navigator.userAgentData;
        if (userAgentData && Array.isArray(userAgentData.brands)) {
            return userAgentData.brands.some((item) => item.brand === "Chromium");
        }
        return /Chrome\//.test(navigator.userAgent);
    }
    const IS_CHROMIUM = isChromiumBrowser();

    let cachedSvgDefs = null;
    let hasWarnedMissingSvgDefs = false;
    function ensureSvgDefs() {
        if (cachedSvgDefs && cachedSvgDefs.isConnected) return cachedSvgDefs;
        let svgDefs = document.getElementById("svg-defs");
        if (svgDefs) {
            cachedSvgDefs = svgDefs;
            return svgDefs;
        }
        if (typeof document !== "undefined" && document.body) {
            const svgWrapper = document.createElement("div");
            svgWrapper.innerHTML = '<svg width="0" height="0" aria-hidden="true" style="position:absolute;overflow:hidden;pointer-events:none;"><defs id="svg-defs"></defs></svg>';
            const svgEl = svgWrapper.firstElementChild;
            if (svgEl) {
                document.body.appendChild(svgEl);
                svgDefs = document.getElementById("svg-defs");
            }
        }
        if (!svgDefs && !hasWarnedMissingSvgDefs) {
            console.warn("[LiquidGlass] Missing #svg-defs and failed to auto-create container.");
            hasWarnedMissingSvgDefs = true;
        }
        cachedSvgDefs = svgDefs;
        return svgDefs;
    }

    const reducedMotionQuery = (typeof window !== "undefined" && window.matchMedia)
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;
    const mobileOrTouchQuery = (typeof window !== "undefined" && window.matchMedia)
        ? window.matchMedia("(max-width: 768px), (pointer: coarse)")
        : null;
    const reducedTransparencyQuery = (typeof window !== "undefined" && window.matchMedia)
        ? window.matchMedia("(prefers-reduced-transparency: reduce)")
        : null;
    const highContrastQuery = (typeof window !== "undefined" && window.matchMedia)
        ? window.matchMedia("(prefers-contrast: more)")
        : null;

    if (reducedMotionQuery?.addEventListener) {
        reducedMotionQuery.addEventListener("change", () => rebuildAllLiquidGlassFilters());
    }
    if (mobileOrTouchQuery?.addEventListener) {
        mobileOrTouchQuery.addEventListener("change", () => rebuildAllLiquidGlassFilters());
    }
    if (reducedTransparencyQuery?.addEventListener) {
        reducedTransparencyQuery.addEventListener("change", () => rebuildAllLiquidGlassFilters());
    }
    if (highContrastQuery?.addEventListener) {
        highContrastQuery.addEventListener("change", () => rebuildAllLiquidGlassFilters());
    }

    function shouldEnableLiquidGlass() {
        if (isLiquidGlassDowngraded) return false;
        if (typeof document !== "undefined" && document.documentElement.classList.contains("low-end-device")) return false;
        if (!IS_CHROMIUM) return false;
        const isReducedMotion = Boolean(reducedMotionQuery?.matches);
        const isMobileOrTouch = Boolean(mobileOrTouchQuery?.matches);
        const isReducedTransparency = Boolean(reducedTransparencyQuery?.matches);
        const isHighContrast = Boolean(highContrastQuery?.matches);
        return !isReducedMotion && !isMobileOrTouch && !isBatteryLow && !isReducedTransparency && !isHighContrast;
    }

    let jankRafId = null;
    let lastJankCheckTime = 0;
    let frameTimeEwma = 16.6;
    let prevDelta1 = 16.6;
    let prevDelta2 = 16.6;
    let slowFramesSustained = 0;
    let fastFramesSustained = 0;

    function stepJankGovernor(timestamp) {
        if (!lastJankCheckTime) {
            lastJankCheckTime = timestamp;
            jankRafId = requestAnimationFrame(stepJankGovernor);
            return;
        }

        const delta = timestamp - lastJankCheckTime;
        lastJankCheckTime = timestamp;

        if (delta > 200) {
            jankRafId = requestAnimationFrame(stepJankGovernor);
            return;
        }

        const clampedDelta = Math.min(delta, 100);
        let filteredDelta = clampedDelta;
        if ((clampedDelta <= prevDelta1 && prevDelta1 <= prevDelta2) || (prevDelta2 <= prevDelta1 && prevDelta1 <= clampedDelta)) {
            filteredDelta = prevDelta1;
        } else if ((prevDelta1 <= clampedDelta && clampedDelta <= prevDelta2) || (prevDelta2 <= clampedDelta && clampedDelta <= prevDelta1)) {
            filteredDelta = clampedDelta;
        } else {
            filteredDelta = prevDelta2;
        }
        prevDelta2 = prevDelta1;
        prevDelta1 = clampedDelta;

        const alpha = filteredDelta > frameTimeEwma ? 0.25 : 0.05;
        frameTimeEwma = alpha * filteredDelta + (1 - alpha) * frameTimeEwma;

        if (frameTimeEwma > 32) {
            slowFramesSustained++;
            fastFramesSustained = 0;
            if (slowFramesSustained > 15 && currentQualityTier < 1) {
                applyQualityTier(1);
                slowFramesSustained = 0;
            } else if (slowFramesSustained > 25 && currentQualityTier === 1) {
                applyQualityTier(2);
                slowFramesSustained = 0;
            } else if (slowFramesSustained > 40 && currentQualityTier === 2) {
                downgradeLiquidGlassToCss();
                slowFramesSustained = 0;
                return;
            }
        } else if (frameTimeEwma < 18) {
            fastFramesSustained++;
            slowFramesSustained = 0;
            if (fastFramesSustained > 60) {
                if (currentQualityTier === 2) {
                    applyQualityTier(1);
                    fastFramesSustained = 0;
                } else if (currentQualityTier === 1) {
                    applyQualityTier(0);
                    fastFramesSustained = 0;
                } else if (!isScrolling && dirtyElements.size === 0) {
                    stopGovernor();
                    return;
                }
            }
        } else {
            slowFramesSustained = Math.max(0, slowFramesSustained - 1);
            fastFramesSustained = Math.max(0, fastFramesSustained - 1);
        }

        jankRafId = requestAnimationFrame(stepJankGovernor);
    }

    function startGovernor() {
        if (jankRafId !== null) return;
        lastJankCheckTime = 0;
        slowFramesSustained = 0;
        fastFramesSustained = 0;
        frameTimeEwma = 16.6;
        prevDelta1 = 16.6;
        prevDelta2 = 16.6;
        jankRafId = requestAnimationFrame(stepJankGovernor);
    }

    function stopGovernor() {
        if (jankRafId !== null) {
            cancelAnimationFrame(jankRafId);
            jankRafId = null;
        }
    }

    function triggerInteractionDetection() {
        startGovernor();
    }

    let resizeLiquidTimer = null;
    let resizeLastScheduleTime = 0;

    function registerTargetElement(element, targetConfig) {
        let state = elementStateMap.get(element);
        if (!state) {
            state = getElementState(element, targetConfig);
        }
        if (sharedResizeObserver) {
            sharedResizeObserver.observe(element);
        }
        if (sharedIntersectionObserver) {
            sharedIntersectionObserver.observe(element);
        }
        return state;
    }

    let intersectionFlushRafId = null;

    function onIntersectionChange(entries) {
        const enabled = shouldEnableLiquidGlass();

        let needsFlush = false;
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const element = entry.target;
            const state = elementStateMap.get(element);
            if (!state || !state.targetConfig) continue;

            const wasIntersecting = state.isIntersecting;
            state.isIntersecting = entry.isIntersecting;
            if (!enabled) continue;

            if (entry.isIntersecting) {
                if (!activeElements.has(element)) {
                    dirtyElements.add(element);
                    needsFlush = true;
                }
            } else if (wasIntersecting && !state.targetConfig.alwaysOn) {
                detachElementFilter(element, state);
            }
        }

        if (needsFlush && dirtyElements.size > 0) {
            if (intersectionFlushRafId === null) {
                intersectionFlushRafId = requestAnimationFrame(() => {
                    intersectionFlushRafId = null;
                    flushDirtyElements();
                });
            }
        }
    }

    function commitFilter(element, state, record, meta, activeRecord = null) {
        const activeFilterId = (currentQualityTier >= 1 && record.filterIdT1) ? record.filterIdT1 : record.filterId;
        if (activeRecord) {
            const activeSubFilterId = (currentQualityTier >= 1 && activeRecord.filterIdT1) ? activeRecord.filterIdT1 : activeRecord.filterId;
            const restVal = `url(#${activeFilterId})`;
            const actVal = `url(#${activeSubFilterId})`;
            if (state.appliedRestVal !== restVal) {
                element.style.setProperty("--lg-filter-rest", restVal);
                state.appliedRestVal = restVal;
            }
            if (state.appliedActiveVal !== actVal) {
                element.style.setProperty("--lg-filter-active", actVal);
                state.appliedActiveVal = actVal;
            }
            if (state.appliedFilterVal !== null) {
                element.style.removeProperty("--lg-filter");
                state.appliedFilterVal = null;
            }
        } else {
            const filterVal = formatGlassFilterStyle(activeFilterId, meta.blurAmt, currentQualityTier);
            if (state.appliedFilterVal !== filterVal) {
                element.style.setProperty("--lg-filter", filterVal);
                state.appliedFilterVal = filterVal;
            }
        }
        const isWChanged = record.lastFeW !== meta.w;
        const isHChanged = record.lastFeH !== meta.h;
        if (record.feImage && isWChanged) {
            record.feImage.setAttribute("width", String(meta.w));
        }
        if (record.feImage && isHChanged) {
            record.feImage.setAttribute("height", String(meta.h));
        }
        if (record.feImageT1 && isWChanged) {
            record.feImageT1.setAttribute("width", String(meta.w));
        }
        if (record.feImageT1 && isHChanged) {
            record.feImageT1.setAttribute("height", String(meta.h));
        }
        if (isWChanged) record.lastFeW = meta.w;
        if (isHChanged) record.lastFeH = meta.h;

        if (activeRecord) {
            const isActiveWChanged = activeRecord.lastFeW !== meta.w;
            const isActiveHChanged = activeRecord.lastFeH !== meta.h;
            if (activeRecord.feImage && isActiveWChanged) {
                activeRecord.feImage.setAttribute("width", String(meta.w));
            }
            if (activeRecord.feImage && isActiveHChanged) {
                activeRecord.feImage.setAttribute("height", String(meta.h));
            }
            if (activeRecord.feImageT1 && isActiveWChanged) {
                activeRecord.feImageT1.setAttribute("width", String(meta.w));
            }
            if (activeRecord.feImageT1 && isActiveHChanged) {
                activeRecord.feImageT1.setAttribute("height", String(meta.h));
            }
            if (isActiveWChanged) activeRecord.lastFeW = meta.w;
            if (isActiveHChanged) activeRecord.lastFeH = meta.h;
        }

        if (!element.classList.contains("lg-on")) {
            element.classList.add("lg-on");
        }
        const radiusVal = `${Math.round(meta.radius)}px`;
        if (state.appliedRadius !== radiusVal) {
            element.style.setProperty("--lg-radius", radiusVal);
            state.appliedRadius = radiusVal;
        }
        if (meta.hasCore) {
            if (!state.isHollow) {
                element.classList.add("lg-hollow");
                state.isHollow = true;
            }
            const bezelVal = `${meta.clampedBezel}px`;
            if (state.appliedBezel !== bezelVal) {
                element.style.setProperty("--lg-bezel", bezelVal);
                state.appliedBezel = bezelVal;
            }
            const innerRadiusVal = `${Math.max(0, Math.round(meta.radius - meta.clampedBezel))}px`;
            if (state.appliedInnerRadius !== innerRadiusVal) {
                element.style.setProperty("--lg-inner-radius", innerRadiusVal);
                state.appliedInnerRadius = innerRadiusVal;
            }
            if (meta.coreFilter && state.appliedCoreFilter !== meta.coreFilter) {
                element.style.setProperty("--lg-core-filter", meta.coreFilter);
                state.appliedCoreFilter = meta.coreFilter;
            }
        } else if (state.isHollow) {
            element.classList.remove("lg-hollow");
            element.style.removeProperty("--lg-bezel");
            element.style.removeProperty("--lg-inner-radius");
            element.style.removeProperty("--lg-core-filter");
            state.isHollow = false;
            state.appliedBezel = null;
            state.appliedInnerRadius = null;
            state.appliedCoreFilter = null;
        }

        currentTotalDeviceArea = currentTotalDeviceArea - (state.deviceArea || 0) + meta.deviceArea;
        state.deviceArea = meta.deviceArea;

        const oldKey = state.sharedKey;
        state.sharedKey = record.key;
        state.pendingKey = null;

        let oldActiveKey = state.activeSharedKey;
        if (activeRecord) {
            state.activeSharedKey = activeRecord.key;
            state.activePendingKey = null;
        } else {
            state.activeSharedKey = null;
            state.activePendingKey = null;
        }

        state.lastW = meta.w;
        state.lastH = meta.h;

        activeElements.add(element);

        if (oldKey) {
            releaseSharedFilter(oldKey);
        }
        if (oldActiveKey) {
            releaseSharedFilter(oldActiveKey);
        }
    }

    function rebuildLiquidGlassFilterForElement(element, targetConfig, premeasured = null) {
        if (!shouldEnableLiquidGlass()) {
            cleanupElementState(element);
            return;
        }

        const state = registerTargetElement(element, targetConfig);

        if (element.parentElement?.closest(".lg-on")) {
            state.rejectionReason = "nested";
            detachElementFilter(element, state);
            return;
        }
        if (state.rejectionReason === "nested") {
            state.rejectionReason = null;
        }

        if (element.childElementCount > 0) {
            for (const activeEl of activeElements) {
                if (activeEl !== element && element.contains(activeEl)) {
                    const childState = elementStateMap.get(activeEl);
                    if (childState) {
                        childState.rejectionReason = "nested";
                        detachElementFilter(activeEl, childState);
                    }
                }
            }
        }

        const svgDefs = ensureSvgDefs();
        if (!element || !svgDefs) return;

        let w;
        let h;
        if (premeasured) {
            w = premeasured.w;
            h = premeasured.h;
        } else {
            w = element.offsetWidth;
            h = element.offsetHeight;
            if (!w || !h) {
                const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
                w = w || Math.round(rect ? rect.width : 0);
                h = h || Math.round(rect ? rect.height : 0);
            }
        }
        if (w < 10 || h < 10) {
            state.lastW = w;
            state.lastH = h;
            applyCssFallback(element, state, "too_small");
            return;
        }
        state.rejectionReason = null;

        if (sharedIntersectionObserver && !state.isIntersecting && !targetConfig.alwaysOn) {
            detachElementFilter(element, state);
            return;
        }

        const halfMinDim = Math.min(w, h) * 0.5;

        const rawRadiusStr = premeasured?.rawRadiusStr ?? (
            state.cachedRadiusStr ?? (
                (typeof window !== "undefined" && window.getComputedStyle)
                    ? window.getComputedStyle(element).borderTopLeftRadius.trim()
                    : ""
            )
        );
        state.cachedRadiusStr = rawRadiusStr;
        let parsedRadius;
        if (rawRadiusStr.endsWith("%")) {
            parsedRadius = (parseFloat(rawRadiusStr) / 100) * Math.min(w, h);
        } else {
            parsedRadius = parseFloat(rawRadiusStr);
        }

        let radius;
        if (targetConfig.isPill) {
            if (!Number.isFinite(parsedRadius) || parsedRadius <= 0) {
                radius = halfMinDim;
            } else {
                radius = Math.min(Math.max(parsedRadius, 0), halfMinDim);
            }
        } else {
            if (Number.isFinite(parsedRadius)) {
                radius = Math.min(Math.max(parsedRadius, 0), halfMinDim);
            } else {
                const fallbackRadius = targetConfig.radius ?? Math.min(Math.round(h * 0.5), 30);
                radius = Math.min(Math.max(fallbackRadius, 0), halfMinDim);
            }
        }

        const surfaceKey = (element.dataset && element.dataset.surface) || targetConfig.surfaceKey;
        const dpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
        const rasterScale = Math.min(dpr, 2);

        const clampedBezel = Math.max(1, Math.min(targetConfig.maxBezel, halfMinDim - 1));
        const hasCore = Boolean(!targetConfig.axis && (w > clampedBezel * 2 + 8) && (h > clampedBezel * 2 + 8));
        const coreFilter = targetConfig.coreFilter || "blur(14px) saturate(140%)";

        const deviceArea = Math.round(w * h * dpr * dpr);
        const oldElementArea = state.deviceArea || 0;

        if (deviceArea > MAX_ELEMENT_DEVICE_AREA) {
            if (!warnedAreaExceededElements.has(element)) {
                console.warn("[LiquidGlass] Element device area exceeds limit:", deviceArea, ">", MAX_ELEMENT_DEVICE_AREA, element);
                warnedAreaExceededElements.add(element);
            }
            applyCssFallback(element, state, "over_element_area");
            return;
        }

        if (currentTotalDeviceArea - oldElementArea + deviceArea > MAX_TOTAL_DEVICE_AREA) {
            if (targetConfig.alwaysOn) {
                for (const activeEl of activeElements) {
                    const activeState = elementStateMap.get(activeEl);
                    if (activeState && !activeState.targetConfig.alwaysOn) {
                        applyCssFallback(activeEl, activeState, "budget_evicted");
                        if (currentTotalDeviceArea - oldElementArea + deviceArea <= MAX_TOTAL_DEVICE_AREA) {
                            break;
                        }
                    }
                }
            }
            if (currentTotalDeviceArea - oldElementArea + deviceArea > MAX_TOTAL_DEVICE_AREA) {
                if (!warnedAreaExceededElements.has(element)) {
                    console.warn("[LiquidGlass] Total GPU device area exceeds limit:", currentTotalDeviceArea - oldElementArea + deviceArea, ">", MAX_TOTAL_DEVICE_AREA, element);
                    warnedAreaExceededElements.add(element);
                }
                applyCssFallback(element, state, "over_total_budget");
                return;
            }
        }

        const QUANTIZE_GRID = 8;
        const quantW = Math.max(QUANTIZE_GRID, Math.round(w / QUANTIZE_GRID) * QUANTIZE_GRID);
        const quantH = Math.max(QUANTIZE_GRID, Math.round(h / QUANTIZE_GRID) * QUANTIZE_GRID);
        const quantRadius = targetConfig.isPill
            ? (Math.min(quantW, quantH) * 0.5)
            : Math.round(radius);

        const tierKey = currentQualityTier === 2 ? "_q2" : "";
        const newSharedKey = `${targetConfig.id}|${quantW}_${quantH}_${rasterScale.toFixed(2)}_${quantRadius.toFixed(1)}_${surfaceKey}${tierKey}`;
        const activeConfig = targetConfig.activeConfig;
        const newActiveKey = activeConfig
            ? `${activeConfig.id}|${quantW}_${quantH}_${rasterScale.toFixed(2)}_${quantRadius.toFixed(1)}_${surfaceKey}${tierKey}`
            : null;

        const matchesSharedKey = state.sharedKey === newSharedKey || state.sharedKey === `${newSharedKey}_${w}x${h}`;
        const matchesActiveKey = !newActiveKey || state.activeSharedKey === newActiveKey || state.activeSharedKey === `${newActiveKey}_${w}x${h}`;

        if (state.pendingKey && (state.pendingKey === newSharedKey || state.pendingKey === `${newSharedKey}_${w}x${h}`) &&
            (!newActiveKey || state.activePendingKey === newActiveKey || state.activePendingKey === `${newActiveKey}_${w}x${h}`)) {
            return;
        }

        if (matchesSharedKey && matchesActiveKey) {
            const rec = sharedFilters.get(state.sharedKey);
            const activeRec = newActiveKey ? sharedFilters.get(state.activeSharedKey) : null;
            if (rec && rec.node?.isConnected && (!newActiveKey || (activeRec && activeRec.node?.isConnected))) {
                state.lastW = w;
                state.lastH = h;
                currentTotalDeviceArea = currentTotalDeviceArea - (state.deviceArea || 0) + deviceArea;
                state.deviceArea = deviceArea;

                if (rec.refCount === 1) {
                    const isWChanged = rec.lastFeW !== w;
                    const isHChanged = rec.lastFeH !== h;
                    if (rec.feImage && isWChanged) {
                        rec.feImage.setAttribute("width", String(w));
                    }
                    if (rec.feImage && isHChanged) {
                        rec.feImage.setAttribute("height", String(h));
                    }
                    if (rec.feImageT1 && isWChanged) {
                        rec.feImageT1.setAttribute("width", String(w));
                    }
                    if (rec.feImageT1 && isHChanged) {
                        rec.feImageT1.setAttribute("height", String(h));
                    }
                    if (isWChanged) rec.lastFeW = w;
                    if (isHChanged) rec.lastFeH = h;
                }
                if (activeRec && activeRec.refCount === 1) {
                    const isActiveWChanged = activeRec.lastFeW !== w;
                    const isActiveHChanged = activeRec.lastFeH !== h;
                    if (activeRec.feImage && isActiveWChanged) {
                        activeRec.feImage.setAttribute("width", String(w));
                    }
                    if (activeRec.feImage && isActiveHChanged) {
                        activeRec.feImage.setAttribute("height", String(h));
                    }
                    if (activeRec.feImageT1 && isActiveWChanged) {
                        activeRec.feImageT1.setAttribute("width", String(w));
                    }
                    if (activeRec.feImageT1 && isActiveHChanged) {
                        activeRec.feImageT1.setAttribute("height", String(h));
                    }
                    if (isActiveWChanged) activeRec.lastFeW = w;
                    if (isActiveHChanged) activeRec.lastFeH = h;
                }

                if (!element.classList.contains("lg-on")) {
                    const activeFilterId = (currentQualityTier >= 1 && rec.filterIdT1) ? rec.filterIdT1 : rec.filterId;
                    if (activeConfig) {
                        const activeSubFilterId = (currentQualityTier >= 1 && activeRec?.filterIdT1) ? activeRec.filterIdT1 : (activeRec?.filterId || "");
                        element.style.setProperty("--lg-filter-rest", `url(#${activeFilterId})`);
                        element.style.setProperty("--lg-filter-active", `url(#${activeSubFilterId})`);
                        element.style.removeProperty("--lg-filter");
                    } else {
                        const filterVal = formatGlassFilterStyle(activeFilterId, targetConfig.blurAmt, currentQualityTier);
                        element.style.setProperty("--lg-filter", filterVal);
                    }
                    element.classList.add("lg-on");
                    activeElements.add(element);
                }
                const radiusVal = `${Math.round(radius)}px`;
                if (state.appliedRadius !== radiusVal) {
                    element.style.setProperty("--lg-radius", radiusVal);
                    state.appliedRadius = radiusVal;
                }
                if (hasCore) {
                    if (!state.isHollow) {
                        element.classList.add("lg-hollow");
                        state.isHollow = true;
                    }
                    const bezelVal = `${clampedBezel}px`;
                    if (state.appliedBezel !== bezelVal) {
                        element.style.setProperty("--lg-bezel", bezelVal);
                        state.appliedBezel = bezelVal;
                    }
                    const innerRadiusVal = `${Math.max(0, Math.round(radius - clampedBezel))}px`;
                    if (state.appliedInnerRadius !== innerRadiusVal) {
                        element.style.setProperty("--lg-inner-radius", innerRadiusVal);
                        state.appliedInnerRadius = innerRadiusVal;
                    }
                    if (coreFilter && state.appliedCoreFilter !== coreFilter) {
                        element.style.setProperty("--lg-core-filter", coreFilter);
                        state.appliedCoreFilter = coreFilter;
                    }
                } else if (state.isHollow) {
                    element.classList.remove("lg-hollow");
                    element.style.removeProperty("--lg-bezel");
                    element.style.removeProperty("--lg-inner-radius");
                    element.style.removeProperty("--lg-core-filter");
                    state.isHollow = false;
                    state.appliedBezel = null;
                    state.appliedInnerRadius = null;
                    state.appliedCoreFilter = null;
                }
                return;
            }
        }

        const record = acquireSharedFilter({
            sharedKey: newSharedKey,
            targetConfig,
            w: quantW,
            h: quantH,
            actualW: w,
            actualH: h,
            radius: quantRadius,
            surfaceKey,
            rasterScale,
            halfMinDim: Math.min(quantW, quantH) * 0.5,
            svgDefs,
        });
        if (!record) return;

        let activeRecord = null;
        if (activeConfig) {
            activeRecord = acquireSharedFilter({
                sharedKey: newActiveKey,
                targetConfig: activeConfig,
                w: quantW,
                h: quantH,
                actualW: w,
                actualH: h,
                radius: quantRadius,
                surfaceKey,
                rasterScale,
                halfMinDim: Math.min(quantW, quantH) * 0.5,
                svgDefs,
            });
        }

        const meta = { w, h, radius, deviceArea, blurAmt: targetConfig.blurAmt, clampedBezel, hasCore, coreFilter };

        if (record.ready && (!activeRecord || activeRecord.ready)) {
            commitFilter(element, state, record, meta, activeRecord);
        } else {
            state.pendingKey = newSharedKey;
            state.activePendingKey = newActiveKey;
            const currentToken = ++state.commitToken;

            const waitPromises = [record.readyPromise || startMapPreload(record)];
            if (activeRecord && !activeRecord.ready) {
                waitPromises.push(activeRecord.readyPromise || startMapPreload(activeRecord));
            }

            Promise.all(waitPromises).then(() => {
                if (state.commitToken !== currentToken || !element.isConnected) {
                    releaseSharedFilter(record.key, record);
                    if (activeRecord) {
                        releaseSharedFilter(activeRecord.key, activeRecord);
                    }
                    return;
                }
                commitFilter(element, state, record, meta, activeRecord);
            });
        }
    }

    function measureElement(element) {
        const state = elementStateMap.get(element);
        let w = state?.observedW || (state?.lastW && state.lastW > 0 ? state.lastW : element.offsetWidth);
        let h = state?.observedH || (state?.lastH && state.lastH > 0 ? state.lastH : element.offsetHeight);
        if (state) {
            state.observedW = 0;
            state.observedH = 0;
        }
        if (!w || !h) {
            const rect = element.getBoundingClientRect ? element.getBoundingClientRect() : null;
            w = w || Math.round(rect ? rect.width : 0);
            h = h || Math.round(rect ? rect.height : 0);
        }
        let rawRadiusStr = state?.cachedRadiusStr;
        if (rawRadiusStr == null) {
            const computedStyle = (typeof window !== "undefined" && window.getComputedStyle)
                ? window.getComputedStyle(element)
                : null;
            rawRadiusStr = computedStyle ? computedStyle.borderTopLeftRadius.trim() : "";
            if (state) {
                state.cachedRadiusStr = rawRadiusStr;
            }
        }
        if (state) {
            if (!state.premeasured) {
                state.premeasured = { w, h, rawRadiusStr };
            } else {
                state.premeasured.w = w;
                state.premeasured.h = h;
                state.premeasured.rawRadiusStr = rawRadiusStr;
            }
            return state.premeasured;
        }
        return { w, h, rawRadiusStr };
    }

    function batchMeasureAndRebuild(elementsWithConfigs) {
        if (!elementsWithConfigs || elementsWithConfigs.length === 0) return;

        const tasks = [];
        for (let i = 0; i < elementsWithConfigs.length; i++) {
            const { element, targetConfig } = elementsWithConfigs[i];
            registerTargetElement(element, targetConfig);
            tasks.push({ element, targetConfig, premeasured: measureElement(element) });
        }

        if (!document.documentElement.classList.contains("liquid-glass-enabled")) {
            document.documentElement.classList.add("liquid-glass-enabled");
        }

        for (let i = 0; i < tasks.length; i++) {
            const task = tasks[i];
            try {
                rebuildLiquidGlassFilterForElement(task.element, task.targetConfig, task.premeasured);
            } catch (err) {
                if (!warnedFailedElements.has(task.element)) {
                    console.warn("[LiquidGlass] rebuild failed:", err);
                    warnedFailedElements.add(task.element);
                }
                cleanupElementState(task.element);
            }
        }
    }

    function rebuildAllLiquidGlassFilters() {
        if (!shouldEnableLiquidGlass()) {
            document.documentElement.classList.remove("liquid-glass-enabled");
            detachGlobalListeners();
            cleanupAllTargetStates();
            return;
        }
        attachGlobalListeners();

        const elementsWithConfigs = [];
        const matchedElements = new Set();
        for (let i = 0; i < GLASS_TARGETS.length; i++) {
            const targetConfig = GLASS_TARGETS[i];
            const elements = document.querySelectorAll(targetConfig.selector);
            const isBadge = targetConfig.id === "badge-liquid-glass-filter";
            for (let j = 0; j < elements.length; j++) {
                const element = elements[j];
                matchedElements.add(element);
                elementsWithConfigs.push({ element, targetConfig });
                if (isBadge) {
                    observeBadgeAnimationsIn(element);
                }
            }
        }

        activeElements.forEach((element) => {
            if (!element.isConnected || !matchedElements.has(element)) {
                cleanupElementState(element);
            }
        });

        batchMeasureAndRebuild(elementsWithConfigs);
    }

    function flushDirtyElements() {
        if (!shouldEnableLiquidGlass()) {
            rebuildAllLiquidGlassFilters();
            dirtyElements.clear();
            return;
        }

        const scheduledTasks = [];
        dirtyElements.forEach((el) => {
            if (!el.isConnected) {
                cleanupElementState(el);
                return;
            }
            const state = elementStateMap.get(el);
            if (!state || !state.targetConfig) return;

            const measured = measureElement(el);
            scheduledTasks.push({ el, targetConfig: state.targetConfig, premeasured: measured });
        });
        dirtyElements.clear();

        for (let i = 0; i < scheduledTasks.length; i++) {
            const task = scheduledTasks[i];
            try {
                rebuildLiquidGlassFilterForElement(task.el, task.targetConfig, task.premeasured);
            } catch (err) {
                if (!warnedFailedElements.has(task.el)) {
                    console.warn("[LiquidGlass] rebuild failed:", err);
                    warnedFailedElements.add(task.el);
                }
                cleanupElementState(task.el);
            }
        }
    }

    function scheduleRebuildLiquidGlass(entries) {
        if (Array.isArray(entries)) {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                const targetElement = entry.target;
                if (!targetElement.isConnected) {
                    cleanupElementState(targetElement);
                    continue;
                }
                const state = elementStateMap.get(targetElement);
                if (state) {
                    const box = entry.borderBoxSize ? (Array.isArray(entry.borderBoxSize) ? entry.borderBoxSize[0] : entry.borderBoxSize) : null;
                    const w = Math.round(box ? box.inlineSize : (entry.contentRect ? entry.contentRect.width : targetElement.offsetWidth));
                    const h = Math.round(box ? box.blockSize : (entry.contentRect ? entry.contentRect.height : targetElement.offsetHeight));

                    if (state.lastW > 0 && w === state.lastW && h === state.lastH) {
                        continue;
                    }

                    if (state.lastW > 0 && state.sharedKey && activeElements.has(targetElement) && sharedFilters.has(state.sharedKey)) {
                        const quantW = Math.max(QUANTIZE_GRID, Math.round(w / QUANTIZE_GRID) * QUANTIZE_GRID);
                        const quantH = Math.max(QUANTIZE_GRID, Math.round(h / QUANTIZE_GRID) * QUANTIZE_GRID);
                        const lastQuantW = Math.max(QUANTIZE_GRID, Math.round(state.lastW / QUANTIZE_GRID) * QUANTIZE_GRID);
                        const lastQuantH = Math.max(QUANTIZE_GRID, Math.round(state.lastH / QUANTIZE_GRID) * QUANTIZE_GRID);

                        if (quantW === lastQuantW && quantH === lastQuantH) {
                            const maxBezel = state.targetConfig?.maxBezel ?? 0;
                            const oldBezel = Math.max(1, Math.min(maxBezel, Math.min(state.lastW, state.lastH) * 0.5 - 1));
                            const newBezel = Math.max(1, Math.min(maxBezel, Math.min(w, h) * 0.5 - 1));

                            if (oldBezel === newBezel) {
                                const dpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;
                                const newArea = Math.round(w * h * dpr * dpr);
                                const newTotalArea = currentTotalDeviceArea - (state.deviceArea || 0) + newArea;

                                if (newArea <= MAX_ELEMENT_DEVICE_AREA && newTotalArea <= MAX_TOTAL_DEVICE_AREA) {
                                    state.lastW = w;
                                    state.lastH = h;
                                    state.observedW = w;
                                    state.observedH = h;
                                    currentTotalDeviceArea = newTotalArea;
                                    state.deviceArea = newArea;

                                    const rec = sharedFilters.get(state.sharedKey);
                                    if (rec && rec.refCount === 1) {
                                        const isWChanged = rec.lastFeW !== w;
                                        const isHChanged = rec.lastFeH !== h;
                                        if (rec.feImage && isWChanged) {
                                            rec.feImage.setAttribute("width", String(w));
                                        }
                                        if (rec.feImage && isHChanged) {
                                            rec.feImage.setAttribute("height", String(h));
                                        }
                                        if (rec.feImageT1 && isWChanged) {
                                            rec.feImageT1.setAttribute("width", String(w));
                                        }
                                        if (rec.feImageT1 && isHChanged) {
                                            rec.feImageT1.setAttribute("height", String(h));
                                        }
                                        if (isWChanged) rec.lastFeW = w;
                                        if (isHChanged) rec.lastFeH = h;
                                    }
                                    if (state.activeSharedKey) {
                                        const activeRec = sharedFilters.get(state.activeSharedKey);
                                        if (activeRec && activeRec.refCount === 1) {
                                            const isActiveWChanged = activeRec.lastFeW !== w;
                                            const isActiveHChanged = activeRec.lastFeH !== h;
                                            if (activeRec.feImage && isActiveWChanged) {
                                                activeRec.feImage.setAttribute("width", String(w));
                                            }
                                            if (activeRec.feImage && isActiveHChanged) {
                                                activeRec.feImage.setAttribute("height", String(h));
                                            }
                                            if (activeRec.feImageT1 && isActiveWChanged) {
                                                activeRec.feImageT1.setAttribute("width", String(w));
                                            }
                                            if (activeRec.feImageT1 && isActiveHChanged) {
                                                activeRec.feImageT1.setAttribute("height", String(h));
                                            }
                                            if (isActiveWChanged) activeRec.lastFeW = w;
                                            if (isActiveHChanged) activeRec.lastFeH = h;
                                        }
                                    }
                                    continue;
                                }
                            }
                        }
                    }

                    if (w > 0 && h > 0) {
                        state.observedW = w;
                        state.observedH = h;
                    }
                    dirtyElements.add(targetElement);
                }
            }
        } else {
            activeElements.forEach((targetElement) => {
                if (targetElement.isConnected) {
                    dirtyElements.add(targetElement);
                } else {
                    cleanupElementState(targetElement);
                }
            });
        }

        if (dirtyElements.size === 0) return;

        const now = performance.now();
        if (resizeLiquidTimer) clearTimeout(resizeLiquidTimer);

        if (now - resizeLastScheduleTime > 250) {
            resizeLastScheduleTime = now;
            requestAnimationFrame(flushDirtyElements);
        } else {
            resizeLiquidTimer = setTimeout(() => {
                resizeLastScheduleTime = performance.now();
                requestAnimationFrame(flushDirtyElements);
            }, 120);
        }

        triggerInteractionDetection();
    }

    const COMBINED_GLASS_SELECTOR = GLASS_TARGETS.map((t) => t.selector).join(", ");

    let isDocumentIdle = false;
    let idleFreezeTimer = null;
    let lastActivityTick = 0;
    let idleScratchCleanupTimer = null;

    function notifyUserActivity(isHighInteraction = false) {
        const currentTime = performance.now();

        if (isDocumentIdle && !isHighInteraction) {
            return;
        }

        if (currentTime - lastActivityTick < 250 && !isDocumentIdle) {
            return;
        }
        lastActivityTick = currentTime;

        if (isDocumentIdle) {
            isDocumentIdle = false;
            document.documentElement.classList.remove("is-idle");
        }

        if (idleFreezeTimer) clearTimeout(idleFreezeTimer);
        idleFreezeTimer = setTimeout(() => {
            isDocumentIdle = true;
            document.documentElement.classList.add("is-idle");
            stopGovernor();
        }, 2200);

        if (idleScratchCleanupTimer) clearTimeout(idleScratchCleanupTimer);
        idleScratchCleanupTimer = setTimeout(() => {
            releaseSharedScratchBmpBuffer();
            releaseSharedScratchArrays();
        }, 10000);
    }

    let interactionRafId = null;
    let pendingScrollInteraction = false;

    function flushInteraction() {
        interactionRafId = null;
        if (pendingScrollInteraction) {
            pendingScrollInteraction = false;
            startGovernor();
            handleScrollState();
        }
        notifyUserActivity(true);
    }

    function queueInteraction(isScroll = false) {
        if (isScroll) pendingScrollInteraction = true;
        if (interactionRafId === null) {
            interactionRafId = requestAnimationFrame(flushInteraction);
        }
    }

    function onScrollInteraction() {
        queueInteraction(true);
    }

    function onGeneralInteraction() {
        queueInteraction(false);
    }

    function onMouseMoveInteraction(e) {
        if (isDocumentIdle && e.target && e.target.closest && e.target.closest(COMBINED_GLASS_SELECTOR)) {
            queueInteraction(false);
        }
    }

    function onWindowBlur() {
        isDocumentIdle = true;
        document.documentElement.classList.add("is-idle");
        stopGovernor();
    }

    let areGlobalListenersAttached = false;

    function attachGlobalListeners() {
        if (areGlobalListenersAttached || typeof window === "undefined") return;
        areGlobalListenersAttached = true;

        window.addEventListener("mousemove", onMouseMoveInteraction, { passive: true });
        window.addEventListener("keydown", onGeneralInteraction, { passive: true });
        window.addEventListener("touchstart", onGeneralInteraction, { passive: true });
        window.addEventListener("pointerdown", onGeneralInteraction, { passive: true });
        window.addEventListener("scroll", onScrollInteraction, { passive: true, capture: true });
        window.addEventListener("wheel", onScrollInteraction, { passive: true });
        window.addEventListener("touchmove", onScrollInteraction, { passive: true });
        window.addEventListener("blur", onWindowBlur, { passive: true });
        window.addEventListener("resize", onWindowResizeCheckDpr, { passive: true });

        if ("onscrollend" in window) {
            window.addEventListener("scrollend", onScrollEnd, { passive: true, capture: true });
        }
        notifyUserActivity(true);
    }

    function detachGlobalListeners() {
        if (!areGlobalListenersAttached || typeof window === "undefined") return;
        areGlobalListenersAttached = false;

        window.removeEventListener("mousemove", onMouseMoveInteraction, { passive: true });
        window.removeEventListener("keydown", onGeneralInteraction, { passive: true });
        window.removeEventListener("touchstart", onGeneralInteraction, { passive: true });
        window.removeEventListener("pointerdown", onGeneralInteraction, { passive: true });
        window.removeEventListener("scroll", onScrollInteraction, { passive: true, capture: true });
        window.removeEventListener("wheel", onScrollInteraction, { passive: true });
        window.removeEventListener("touchmove", onScrollInteraction, { passive: true });
        window.removeEventListener("blur", onWindowBlur, { passive: true });
        window.removeEventListener("resize", onWindowResizeCheckDpr, { passive: true });

        if ("onscrollend" in window) {
            window.removeEventListener("scrollend", onScrollEnd, { passive: true, capture: true });
        }

        if (interactionRafId !== null) {
            cancelAnimationFrame(interactionRafId);
            interactionRafId = null;
        }
        if (intersectionFlushRafId !== null) {
            cancelAnimationFrame(intersectionFlushRafId);
            intersectionFlushRafId = null;
        }
        if (idleFreezeTimer !== null) {
            clearTimeout(idleFreezeTimer);
            idleFreezeTimer = null;
        }
        if (idleScratchCleanupTimer !== null) {
            clearTimeout(idleScratchCleanupTimer);
            idleScratchCleanupTimer = null;
        }
        stopGovernor();
    }

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            stopGovernor();
            if (!document.hidden) {
                if (shouldEnableLiquidGlass()) {
                    rebuildAllLiquidGlassFilters();
                }
            } else {
                onWindowBlur();
                releaseSharedScratchBmpBuffer();
                releaseSharedScratchArrays();
            }
        }, { passive: true });
    }

    window.addEventListener("pageshow", (e) => {
        if (e.persisted && shouldEnableLiquidGlass()) {
            rebuildAllLiquidGlassFilters();
        }
    }, { passive: true });

    window.addEventListener("pagehide", () => {
        detachGlobalListeners();
        cleanupAllTargetStates();
        releaseSharedScratchBmpBuffer();
        releaseSharedScratchArrays();
    }, { passive: true });

    if (typeof window !== "undefined") {
        Object.defineProperty(window, "__LG_DEBUG_STATS__", {
            get() {
                const profileBytes = refractionProfileCache.size * 128 * 4;
                const totalCacheBytes = (sharedScratchBmpCapacity || 0) + geometryCacheBytes + profileBytes;
                const svgDefs = document.getElementById("svg-defs");
                const filterNodeCount = svgDefs ? svgDefs.querySelectorAll("filter").length : 0;
                const expectedFilterNodes = sharedFilters.size * 2;
                const invariantHeld = (filterNodeCount === expectedFilterNodes || filterNodeCount === sharedFilters.size) &&
                    (activeBlobUrlCount === sharedFilters.size);

                let tierStr = "T0";
                if (isLiquidGlassDowngraded) {
                    tierStr = "CSS fallback";
                } else if (currentQualityTier === 1) {
                    tierStr = "T1";
                } else if (currentQualityTier === 2) {
                    tierStr = "T2";
                }

                return {
                    liveFilters: sharedFilters.size,
                    filterNodeCount,
                    expectedFilterNodes,
                    activeBlobUrls: activeBlobUrlCount,
                    invariantHeld,
                    totalCacheBytes,
                    acquireCallsPerMinute: acquireCountMinute,
                    qualityTier: tierStr,
                    downgrades: qualityDowngradeCount,
                    upgrades: qualityUpgradeCount,
                    maps: Object.assign({}, debugMaps),
                };
            },
            configurable: true,
            enumerable: true,
        });

        const isDebugRequested = window.__LG_DEBUG__ === true ||
            (typeof location !== "undefined" && /[?&]lgdebug=1\b/.test(location.search));
        if (isDebugRequested) {
            console.log("[LiquidGlass Debug] Monitoring active. Access stats via window.__LG_DEBUG_STATS__");
            window.__LG_TEST__ = {
                getRefractionProfile,
                createGlassGeometryCache,
                renderDisplacementMapToBuffer,
                sharedFilters,
                getSharedBmpBuffer,
            };
        }
    }

    let badgeAnimationObserver = null;

    function observeBadgeAnimationsIn(node) {
        if (!badgeAnimationObserver || !node || node.nodeType !== 1) return;
        if (node.matches && node.matches(".badge-liquid-card")) {
            badgeAnimationObserver.observe(node);
        }
        if (node.firstElementChild && node.querySelectorAll) {
            const nested = node.querySelectorAll(".badge-liquid-card");
            for (let i = 0; i < nested.length; i++) {
                badgeAnimationObserver.observe(nested[i]);
            }
        }
    }

    function initBadgeAnimationObserver() {
        if (typeof document !== "undefined" && document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => initBadgeAnimationObserver(), { once: true });
            return;
        }

        const IntersectionObserverClass = window.IntersectionObserver || (typeof IntersectionObserver !== "undefined" ? IntersectionObserver : null);
        if (!IntersectionObserverClass || badgeAnimationObserver) return;
        if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        if (document.documentElement && document.documentElement.classList.contains("low-end-device")) return;

        badgeAnimationObserver = new IntersectionObserverClass((entries) => {
            for (let i = 0; i < entries.length; i++) {
                const entry = entries[i];
                entry.target.classList.toggle("is-offscreen", !entry.isIntersecting);
            }
        }, {
            rootMargin: "100px 0px 100px 0px",
        });

        const badges = document.querySelectorAll(".badge-liquid-card");
        for (let i = 0; i < badges.length; i++) {
            badgeAnimationObserver.observe(badges[i]);
        }
    }

    function initLiquidGlass() {
        if (typeof window !== "undefined") {
            if (window.__LG_INIT__) return;
            window.__LG_INIT__ = true;
            window.__LG_REFRESH__ = rebuildAllLiquidGlassFilters;
            window.__LG_DOWNGRADE__ = downgradeLiquidGlassToCss;
        }

        detectDevicePerformance();

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => initBadgeAnimationObserver(), { once: true });
        } else {
            initBadgeAnimationObserver();
        }

        lastKnownDpr = typeof window.devicePixelRatio === "number" ? window.devicePixelRatio : 1;

        const ResizeObserverClass = window.ResizeObserver || (typeof ResizeObserver !== "undefined" ? ResizeObserver : null);
        if (ResizeObserverClass && !sharedResizeObserver) {
            sharedResizeObserver = new ResizeObserverClass(scheduleRebuildLiquidGlass);
        } else if (!ResizeObserverClass) {
            window.addEventListener("resize", scheduleRebuildLiquidGlass, { passive: true });
        }

        const IntersectionObserverClass = window.IntersectionObserver || (typeof IntersectionObserver !== "undefined" ? IntersectionObserver : null);
        if (IntersectionObserverClass && !sharedIntersectionObserver) {
            sharedIntersectionObserver = new IntersectionObserverClass(onIntersectionChange, {
                rootMargin: "200px 0px 200px 0px",
            });
        }

        rebuildAllLiquidGlassFilters();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            requestAnimationFrame(() => requestAnimationFrame(initLiquidGlass));
        });
    } else {
        requestAnimationFrame(() => requestAnimationFrame(initLiquidGlass));
    }
})();

