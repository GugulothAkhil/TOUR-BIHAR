document.addEventListener("DOMContentLoaded", () => {
  // --- Splash Screen & Initial Transitions ---
  const splashScreen = document.getElementById("splash-screen");
  const mainContent = document.getElementById("main-content");
  
  // Animate Splash Screen Line
  setTimeout(() => {
    const splashLine = document.getElementById("splash-line");
    const splashText = document.getElementById("splash-text");
    if (splashLine) splashLine.style.width = "120px";
    if (splashText) {
      splashText.style.opacity = "1";
      splashText.style.transform = "translateY(0)";
    }
  }, 100);

  // Load Icons
  lucide.createIcons();

  // Haversine Distance Utility
  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
  }

  // State
  let geoData = null;
  let selectedPlace = null;
  let visitedPlaces = JSON.parse(localStorage.getItem('visitedPlaces') || '{}');
  let selectedPlaces = [];
  let currentPopupPlace = null;

  // --- Tour Planner Logic ---
  const tourPlanFab = document.getElementById("tour-plan-fab");
  const tourPlanBadge = document.getElementById("tour-plan-badge");
  const tourPlanModal = document.getElementById("tour-plan-modal");
  const closeTourPlanBtn = document.getElementById("close-tour-plan");
  const tourPlanList = document.getElementById("tour-plan-list");
  const tourPlanEmpty = document.getElementById("tour-plan-empty");
  const generateRouteBtn = document.getElementById("generate-route-btn");
  const tourRouteResult = document.getElementById("tour-route-result");
  const tourRouteSteps = document.getElementById("tour-route-steps");
  const popupAddToPlanBtn = document.getElementById("popup-add-to-plan");

  if(tourPlanFab) {
    tourPlanFab.addEventListener("click", () => {
      tourPlanModal.classList.remove("-translate-x-full");
      renderTourPlan();
    });
  }

  if(closeTourPlanBtn) {
    closeTourPlanBtn.addEventListener("click", () => {
      tourPlanModal.classList.add("-translate-x-full");
    });
  }

  function updateTourPlanBadge() {
    if(selectedPlaces.length > 0) {
      tourPlanFab.classList.remove("hidden");
      tourPlanBadge.textContent = selectedPlaces.length;
    } else {
      tourPlanFab.classList.add("hidden");
    }
  }

  function addToPlan(place) {
    const exists = selectedPlaces.find(p => p.name === place.name && p.dist === place.dist);
    if(!exists) {
      selectedPlaces.push(place);
      updateTourPlanBadge();
      alert(`${place.name} added to your plan!`);
    } else {
      alert(`${place.name} is already in your plan.`);
    }
  }

  function removeFromPlan(index) {
    selectedPlaces.splice(index, 1);
    updateTourPlanBadge();
    renderTourPlan();
  }
  window.removeFromPlan = removeFromPlan;

  function renderTourPlan() {
    d3.select("#route-layer").selectAll("*").remove(); // clear visual route
    tourRouteResult.classList.add("hidden");
    if(selectedPlaces.length === 0) {
      tourPlanEmpty.classList.remove("hidden");
      tourPlanList.innerHTML = "";
      generateRouteBtn.disabled = true;
      return;
    }
    tourPlanEmpty.classList.add("hidden");
    generateRouteBtn.disabled = false;
    
    const grouped = {};
    selectedPlaces.forEach((p, idx) => {
      if(!grouped[p.dist]) grouped[p.dist] = [];
      grouped[p.dist].push({ ...p, originalIndex: idx });
    });

    let html = "";
    for(const dist in grouped) {
      html += `
        <div class="mb-4">
          <h5 class="text-xs font-bold text-primary uppercase tracking-wider mb-2 border-b border-border pb-1">${dist}</h5>
          <div class="space-y-2">
      `;
      grouped[dist].forEach(p => {
        html += `
          <div class="flex items-center justify-between bg-card p-2 rounded border border-border">
            <span class="text-sm font-medium text-foreground">${p.name}</span>
            <button class="text-red-400 hover:text-red-300 transition-colors p-1" onclick="window.removeFromPlan(${p.originalIndex})">
              <i data-lucide="trash-2" class="w-3 h-3"></i>
            </button>
          </div>
        `;
      });
      html += `</div></div>`;
    }
    tourPlanList.innerHTML = html;
    lucide.createIcons();
  }

  if(popupAddToPlanBtn) {
    popupAddToPlanBtn.addEventListener("click", () => {
      if(currentPopupPlace) {
        addToPlan(currentPopupPlace);
      }
    });
  }

  if(generateRouteBtn) {
    generateRouteBtn.addEventListener("click", generateOptimalRoute);
  }

  function generateOptimalRoute() {
    if(selectedPlaces.length === 0) return;
    const uniqueDistricts = [...new Set(selectedPlaces.map(p => p.dist))];
    let currentLoc = { lat: PATNA_COORDS.lat, lng: PATNA_COORDS.lng };
    let unvisited = [...uniqueDistricts];
    let route = [];

    while(unvisited.length > 0) {
      let nearestDist = null;
      let minDistance = Infinity;
      let nearestIdx = -1;

      unvisited.forEach((dist, idx) => {
        const coords = biharDistrictCoordinates[dist] || PATNA_COORDS;
        const distTo = haversineDistance(currentLoc.lat, currentLoc.lng, coords.lat, coords.lng);
        if(distTo < minDistance) {
          minDistance = distTo;
          nearestDist = dist;
          nearestIdx = idx;
        }
      });

      route.push(nearestDist);
      const c = biharDistrictCoordinates[nearestDist];
      if(c) currentLoc = { lat: c.lat, lng: c.lng };
      unvisited.splice(nearestIdx, 1);
    }
    renderOptimalRoute(route);
  }

  function renderOptimalRoute(routeDistricts) {
    let html = "";
    routeDistricts.forEach((dist, idx) => {
      const placesInDist = selectedPlaces.filter(p => p.dist === dist);
      html += `
        <div class="relative pl-4 pb-4">
          <div class="absolute left-[-4px] top-1 h-2 w-2 rounded-full bg-primary ring-4 ring-background"></div>
          <p class="text-xs font-bold text-foreground mb-1">Step ${idx + 1}: ${dist}</p>
          <ul class="text-xs text-muted-foreground list-disc list-inside space-y-1">
            ${placesInDist.map(p => `<li>${p.name}</li>`).join('')}
          </ul>
        </div>
      `;
    });
    
    tourRouteSteps.innerHTML = html;
    tourRouteResult.classList.remove("hidden");
    drawRouteOnMap(routeDistricts);

    setTimeout(() => {
      tourPlanModal.scrollTo({ top: tourPlanModal.scrollHeight, behavior: 'smooth' });
    }, 100);
  }

  function drawRouteOnMap(routeDistricts) {
    const routeLayer = d3.select("#route-layer");
    routeLayer.selectAll("*").remove();

    const points = routeDistricts.map(d => getDistrictCentroid(d)).filter(p => p !== null);
    if(points.length < 2) return;

    const lineGenerator = d3.line().x(d => d[0]).y(d => d[1]).curve(d3.curveMonotoneX);

    const path = routeLayer.append("path")
      .datum(points)
      .attr("d", lineGenerator)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "5,5")
      .style("filter", "drop-shadow(0px 0px 4px rgba(255,255,255,0.8))");

    const totalLength = path.node().getTotalLength();
    path
      .attr("stroke-dashoffset", totalLength)
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .transition()
      .duration(2000)
      .ease(d3.easeLinear)
      .attr("stroke-dashoffset", 0)
      .on("end", function() {
        d3.select(this).style("animation", "dashRoute 20s linear infinite");
        d3.select(this).attr("stroke-dasharray", "5,5");
      });

    points.forEach((p, i) => {
      routeLayer.append("circle")
        .attr("cx", p[0])
        .attr("cy", p[1])
        .attr("r", 0)
        .attr("fill", "black")
        .attr("stroke", "white")
        .attr("stroke-width", 1.5)
        .transition()
        .delay(i * (2000 / points.length))
        .duration(300)
        .attr("r", 8);

      routeLayer.append("text")
        .attr("x", p[0])
        .attr("y", p[1] + 3)
        .attr("text-anchor", "middle")
        .attr("fill", "white")
        .attr("font-size", "8px")
        .attr("font-weight", "bold")
        .text(i + 1)
        .attr("opacity", 0)
        .transition()
        .delay(i * (2000 / points.length) + 100)
        .duration(300)
        .attr("opacity", 1);
    });
  }

  const downloadMapBtn = document.getElementById("download-map-btn");
  if(downloadMapBtn) {
    downloadMapBtn.addEventListener("click", () => {
      const svgElement = document.getElementById("bihar-map-svg");
      const clone = svgElement.cloneNode(true);
      
      // Inline styles for exporting
      const paths = clone.querySelectorAll("path.district-path");
      paths.forEach(p => {
        p.style.fill = p.classList.contains("capital") ? "white" : "#1a1a1a";
        p.style.stroke = "#333333";
        p.style.strokeWidth = "1px";
      });

      clone.querySelectorAll("text").forEach(t => {
        if(!t.style.fill) t.style.fill = "white";
        t.style.fontFamily = "sans-serif";
      });

      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(clone);
      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(blob);
      
      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1440;
        const ctx = canvas.getContext("2d");
        
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        
        const png = canvas.toDataURL("image/png");
        const a = document.createElement("a");
        a.download = "Bihar_Tour_Roadmap.png";
        a.href = png;
        a.click();
        URL.revokeObjectURL(blobURL);
      };
      image.src = blobURL;
    });
  }

  // --- Map Logic ---
  const BIHAR_GEOJSON_URL = "https://cdn.jsdelivr.net/gh/udit-001/india-maps-data/geojson/states/bihar.geojson";
  const mapSvg = d3.select("#bihar-map-svg");
  const g = d3.select("#map-g");
  let projection, pathGenerator;

  fetch(BIHAR_GEOJSON_URL)
    .then(r => r.json())
    .then(data => {
      geoData = data;
      // Splash screen SVG path calculation (fit to 300x300)
      const splashProj = d3.geoMercator().fitSize([300, 300], data);
      const splashGen = d3.geoPath().projection(splashProj);
      const splashD = data.features.map(f => splashGen(f)).join(" ");
      const splashPath = document.getElementById("splash-path");
      if (splashPath) {
        splashPath.setAttribute("d", splashD);
        splashPath.style.transition = "stroke-dashoffset 1.5s ease-in-out";
        const length = splashPath.getTotalLength();
        splashPath.style.strokeDasharray = length;
        splashPath.style.strokeDashoffset = length;
        requestAnimationFrame(() => {
          splashPath.style.strokeDashoffset = 0;
        });
      }

      // Hide Splash and Show Main App
      setTimeout(() => {
        splashScreen.style.opacity = "0";
        setTimeout(() => {
          splashScreen.style.display = "none";
          mainContent.classList.remove("hidden");
          setTimeout(() => {
            mainContent.classList.remove("opacity-0");
            initMap();
          }, 50);
        }, 800);
      }, 2500);
    });

  function getDistrictName(feature) {
    return feature.properties.district || feature.properties.dtname || feature.properties.NAME_2 || "Unknown";
  }

  function initMap() {
    projection = d3.geoMercator().fitSize([600, 680], geoData);
    pathGenerator = d3.geoPath().projection(projection);

    const paths = g.selectAll("g.district")
      .data(geoData.features)
      .enter()
      .append("g")
      .attr("class", "district")
      .style("cursor", "pointer")
      .on("click", (event, d) => {
        openDistrictPanel(getDistrictName(d));
      });

    // Append Paths
    paths.append("path")
      .attr("d", pathGenerator)
      .attr("class", d => {
        const name = getDistrictName(d);
        return `district-path ${name === 'Patna' ? 'capital' : ''}`;
      })
      .style("animation", (d, i) => `fadeIn 0.3s ease ${i * 0.02}s both`)
      .on("mouseenter", function(event, d) {
        d3.select(this).classed("hovered", true);
        d3.select(this.parentNode).select("text").attr("font-size", name => name === 'Patna' ? 7 : 7).attr("opacity", 1);
      })
      .on("mouseleave", function(event, d) {
        d3.select(this).classed("hovered", false);
        const name = getDistrictName(d);
        d3.select(this.parentNode).select("text").attr("font-size", name === 'Patna' ? 7 : 5).attr("opacity", name === 'Patna' ? 1 : 0.5);
      });

    // Append Labels
    paths.append("text")
      .attr("transform", d => {
        const centroid = d3.geoCentroid(d);
        const projected = projection(centroid);
        return `translate(${projected[0]}, ${projected[1]})`;
      })
      .attr("text-anchor", "middle")
      .attr("class", "pointer-events-none select-none fill-foreground font-body")
      .attr("font-size", d => getDistrictName(d) === 'Patna' ? 7 : 5)
      .attr("opacity", d => getDistrictName(d) === 'Patna' ? 1 : 0.5)
      .attr("font-weight", d => getDistrictName(d) === 'Patna' ? 600 : 400)
      .text(d => {
        const name = getDistrictName(d);
        return name + (name === 'Patna' ? " â˜…" : "");
      });

    // Map Zoom & Pan functionality
    const zoom = d3.zoom()
      .scaleExtent([1, 6])
      .on("zoom", (event) => {
        g.style("transform", `translate3d(${event.transform.x}px, ${event.transform.y}px, 0) scale(${event.transform.k})`);
      });
    
    d3.select("#map-container").call(zoom);
    g.append("g").attr("id", "route-layer").style("pointer-events", "none");
  }

  function getDistrictCentroid(name) {
    if(!geoData) return null;
    const feature = geoData.features.find(f => getDistrictName(f) === name);
    if(feature) {
      const centroid = d3.geoCentroid(feature);
      return projection(centroid);
    }
    return null;
  }

  // --- District Panel Logic ---
  const districtPanel = document.getElementById("district-panel");
  const closePanelBtn = document.getElementById("close-panel");
  const panelContent = document.getElementById("panel-content");
  const distanceContainer = document.getElementById("distance-container");
  
  closePanelBtn.addEventListener("click", () => {
    districtPanel.classList.add("translate-x-full");
    // Ensure popup closes when panel closes
    closePlacePopup();
  });

  function openDistrictPanel(district) {
    document.getElementById("panel-district-name").textContent = district;
    
    // Distance calculation
    if (biharDistrictCoordinates[district]) {
      if (district === "Patna") {
        document.getElementById("distance-value").textContent = "0 km";
      } else {
        const coords = biharDistrictCoordinates[district];
        const dist = haversineDistance(PATNA_COORDS.lat, PATNA_COORDS.lng, coords.lat, coords.lng);
        document.getElementById("distance-value").textContent = `${dist} km`;
      }
      distanceContainer.classList.remove("opacity-0", "-translate-y-2");
    } else {
      distanceContainer.classList.add("opacity-0", "-translate-y-2");
    }

    const info = biharTourismData[district] || {
      categorizedPlaces: {}, bestFood: [], bestTimeToVisit: "",
      openingClosingTimings: "", history: {}, nearbyCities: []
    };

    renderPanelContent(info, district);
    districtPanel.classList.remove("translate-x-full");
    lucide.createIcons();
  }

  function renderPanelContent(info, district) {
    let ht = '';
    
    // Categorized Places
    ht += `<div class="animate-fadeIn">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-foreground"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i></span>
        <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Categorized Places to Visit</h4>
      </div>
      <div class="space-y-2" id="categories-container">`;
    
    const categories = Object.keys(info.categorizedPlaces || {});
    if (categories.length === 0) {
      ht += `<p class="text-xs text-muted-foreground italic">No categorized places available.</p>`;
    } else {
      categories.forEach((cat, idx) => {
        const places = info.categorizedPlaces[cat];
        ht += `
          <div class="rounded-md border border-border bg-card/50 overflow-hidden">
            <button class="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-white hover:bg-accent transition-colors category-btn" data-target="cat-${idx}">
              <span class="flex items-center gap-2">${cat} <span class="rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px]">${places.length}</span></span>
              <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform duration-200" id="cat-icon-${idx}"></i>
            </button>
            <div id="cat-${idx}" class="hidden bg-background/50 overflow-hidden text-sm">
              <ul class="px-3 py-2 space-y-1">
        `;
        places.forEach(place => {
          const isVisited = visitedPlaces[place.name];
          const visitedTextClass = isVisited ? 'text-white font-bold opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]' : 'font-medium text-muted-foreground group-hover:text-primary';
          const circleColor = isVisited ? 'text-primary brightness-125' : 'text-muted-foreground';
          const circleFill = isVisited ? 'currentColor' : 'none';
          
          ht += `
                <li>
                  <div class="flex w-full items-center justify-between gap-2 rounded-md p-1.5 transition-colors hover:bg-primary/10 group/item">
                    <button class="group flex-1 text-left focus:outline-none place-btn" data-pname="${place.name.replace(/"/g, '&quot;')}" data-pdetail="${(place.detail||'').replace(/"/g, '&quot;')}" data-pdist="${district}" data-pimage="${(place.image||'').replace(/"/g, '&quot;')}">
                      <span class="text-xs transition-colors visited-text ${visitedTextClass}">${place.name}</span>
                    </button>
                    <button class="flex-shrink-0 transition-colors focus:outline-none toggle-visited" data-pname="${place.name.replace(/"/g, '&quot;')}">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${circleFill}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${circleColor} ${isVisited ? '' : 'hover:text-white'}"><circle cx="12" cy="12" r="10"></circle></svg>
                    </button>
                  </div>
                </li>`;
        });
        ht += `</ul></div></div>`;
      });
    }
    ht += `</div></div><div class="h-6"></div>`;

    // Food
    ht += `<div class="animate-fadeIn">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-foreground"><i data-lucide="utensils" class="w-3.5 h-3.5"></i></span>
        <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Best Food</h4>
      </div>
      <ul class="space-y-2">`;
    (info.bestFood || []).forEach(f => {
      ht += `<li class="flex items-start gap-2 text-xs text-muted-foreground">
        <span class="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-foreground"></span>${f}
      </li>`;
    });
    ht += `</ul></div><div class="h-6"></div>`;

    // Time to Visit
    ht += `<div class="animate-fadeIn">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-foreground"><i data-lucide="calendar" class="w-3.5 h-3.5"></i></span>
        <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Best Time to Visit</h4>
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">${info.bestTimeToVisit || ''}</p>
    </div><div class="h-6"></div>`;

    // History sections
    ht += `<div class="animate-fadeIn">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-foreground"><i data-lucide="book-open" class="w-3.5 h-3.5"></i></span>
        <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Detailed History</h4>
      </div>
      <div>`;
    ['Ancient', 'Medieval', 'Colonial', 'Modern'].forEach(period => {
      const perKey = period.toLowerCase();
      if(info.history && info.history[perKey]) {
        ht += `<div class="border-b border-border">
          <button class="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-foreground transition-colors hover:text-muted-foreground history-btn">
            ${period} Period
            <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform duration-200"></i>
          </button>
          <div class="hidden overflow-hidden transition-all duration-300">
            <p class="pb-4 text-xs leading-relaxed text-muted-foreground">${info.history[perKey]}</p>
          </div>
        </div>`;
      }
    });
    ht += `</div></div><div class="h-6"></div>`;

    // Nearby
    if (info.nearbyCities && info.nearbyCities.length > 0) {
      ht += `<div class="animate-fadeIn">
        <div class="mb-3 flex items-center gap-2">
          <span class="text-foreground"><i data-lucide="map-pin" class="w-3.5 h-3.5"></i></span>
          <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Nearby Cities & Checkpoints</h4>
        </div>
        <ul class="space-y-2 flex flex-wrap gap-2">`;
      info.nearbyCities.forEach(city => {
        ht += `<li class="flex items-center gap-1 rounded-sm border border-border bg-card px-2 py-1 text-xs text-muted-foreground">${city}</li>`;
      });
      ht += `</ul></div><div class="h-6"></div>`;
    }

    // Timings
    ht += `<div class="animate-fadeIn">
      <div class="mb-3 flex items-center gap-2">
        <span class="text-foreground"><i data-lucide="clock" class="w-3.5 h-3.5"></i></span>
        <h4 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Opening & Closing Timings</h4>
      </div>
      <p class="text-xs leading-relaxed text-muted-foreground">${info.openingClosingTimings || ''}</p>
    </div><div class="h-6"></div>`;

    panelContent.innerHTML = ht;

    // Attach Category toggle events
    document.querySelectorAll('.category-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetId = e.currentTarget.getAttribute('data-target');
        const target = document.getElementById(targetId);
        const icon = e.currentTarget.querySelector('i');
        
        // Hide others (optional, original app doesn't strictly force accordion but we can toggle)
        if(target.classList.contains('hidden')) {
          target.classList.remove('hidden');
          icon.style.transform = 'rotate(180deg)';
        } else {
          target.classList.add('hidden');
          icon.style.transform = 'rotate(0deg)';
        }
      });
    });

    // Attach History toggle events
    document.querySelectorAll('.history-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const content = e.currentTarget.nextElementSibling;
        const icon = e.currentTarget.querySelector('i');
        if(content.classList.contains('hidden')) {
          content.classList.remove('hidden');
          icon.style.transform = 'rotate(180deg)';
        } else {
          content.classList.add('hidden');
          icon.style.transform = 'rotate(0deg)';
        }
      });
    });

    // Place Select
    document.querySelectorAll('.place-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const pName = e.currentTarget.getAttribute('data-pname');
        const pDetail = e.currentTarget.getAttribute('data-pdetail');
        const pDist = e.currentTarget.getAttribute('data-pdist');
        const pImage = e.currentTarget.getAttribute('data-pimage');
        openPlacePopup(pName, pDetail || "A deeply historical spot serving devotees and culture enthusiasts.", pDist, pImage);
      });
    });

    // Visited Toggle
    document.querySelectorAll('.toggle-visited').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const pName = e.currentTarget.getAttribute('data-pname');
        visitedPlaces[pName] = !visitedPlaces[pName];
        localStorage.setItem('visitedPlaces', JSON.stringify(visitedPlaces));
        
        // Update DOM for this button and parent text manually to avoid full re-render
        const isVisited = visitedPlaces[pName];
        const svg = e.currentTarget.querySelector('svg');
        const textSpan = e.currentTarget.previousElementSibling.querySelector('.visited-text');
        
        if (isVisited) {
          svg.setAttribute('fill', 'currentColor');
          svg.setAttribute('class', 'text-primary brightness-125 hover:text-white');
          textSpan.className = 'text-xs transition-colors visited-text text-white font-bold opacity-100 drop-shadow-[0_0_8px_rgba(255,255,255,0.7)]';
        } else {
          svg.setAttribute('fill', 'none');
          svg.setAttribute('class', 'text-muted-foreground hover:text-white');
          textSpan.className = 'text-xs transition-colors visited-text font-medium text-muted-foreground group-hover:text-primary';
        }
      });
    });
  }

  // --- Popup / Modal Logic ---
  const popup = document.getElementById("place-popup");
  const popupContent = document.getElementById("place-popup-content");
  const closePopupBtn = document.getElementById("close-popup");
  const popupImage = document.getElementById("popup-image");
  const popupImageLoader = document.getElementById("popup-image-loader");
  
  // Generic beautiful Indian tourism/religious images to use deterministically as placeholders
  const genericImages = [
    "https://images.unsplash.com/photo-1514222026569-8086036b1397?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1548013146-72479768bada?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1587595431973-160d0d94add1?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1600100397608-ce23e4293f94?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1570168007204-dfb528c6958f?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1621008625624-ad81ff3a89a0?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1561361513-2d000a50f0dc?q=80&w=800&auto=format&fit=crop",
    "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?q=80&w=800&auto=format&fit=crop"
  ];

  function getDetermininsticImage(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return genericImages[Math.abs(hash) % genericImages.length];
  }

  async function fetchOriginalPlaceImage(name, dist) {
    try {
      const query = encodeURIComponent(name + " " + dist + " Bihar");
      const url = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${query}&gsrlimit=1&prop=pageimages&pithumbsize=800&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      if (data.query && data.query.pages) {
        const pages = data.query.pages;
        const pageId = Object.keys(pages)[0];
        if (pages[pageId] && pages[pageId].thumbnail && pages[pageId].thumbnail.source) {
          return pages[pageId].thumbnail.source;
        }
      }
      return null;
    } catch (e) {
      console.warn("Could not fetch image for " + name, e);
      return null;
    }
  }

  function getMocksHotelsHTML(placeName, distName) {
    let hotels = [];

    if (distName === "Patna") {
      hotels = [
        { 
          name: "Hotel Maurya Patna", rating: "5 Star", price: "High Range", contact: "+91 612 220 3040", address: "South Gandhi Maidan, Patna", details: "Luxury stay with premium amenities, pool, and fine dining.",
          rooms: [
            { type: "Presidential Suite", price: "₹18,000 / night", perks: "Private Lounge, Butler, King Bed" },
            { type: "Club Premier", price: "₹9,000 / night", perks: "City View, King Bed, Free Breakfast" }
          ]
        },
        { 
          name: "The Panache Hotel", rating: "4 Star", price: "Medium Range", contact: "+91 612 222 0301", address: "West Gandhi Maidan, Patna", details: "Comfortable stay with great food and excellent service.",
          rooms: [
            { type: "Executive Suite", price: "₹6,500 / night", perks: "Lounge Access, Queen Bed" },
            { type: "Standard Deluxe", price: "₹4,000 / night", perks: "Queen Bed, Free Wi-Fi" }
          ]
        },
        { 
          name: "Hotel President", rating: "3 Star", price: "Low Range", contact: "+91 612 220 9940", address: "Fraser Road, Patna", details: "Affordable and clean basic accommodation.",
          rooms: [
            { type: "Standard Double", price: "₹2,500 / night", perks: "Double Bed, AC" },
            { type: "Basic Single", price: "₹1,500 / night", perks: "Single Bed, Non-AC" }
          ]
        }
      ];
    } else if (distName === "Gaya") {
      hotels = [
        { 
          name: "Taj Darbar Hotel", rating: "4 Star", price: "High Range", contact: "+91 631 220 0086", address: "Bodh Gaya, Gaya", details: "Close to Mahabodhi Temple with excellent dining.",
          rooms: [
            { type: "Suite Room", price: "₹10,000 / night", perks: "Temple View, King Bed" },
            { type: "Deluxe Room", price: "₹6,000 / night", perks: "Garden View, Queen Bed" }
          ]
        },
        { 
          name: "Oaks Bodhgaya", rating: "4 Star", price: "Medium Range", contact: "+91 631 220 0210", address: "Bodhgaya Road, Gaya", details: "Modern aesthetic with great comfort.",
          rooms: [
            { type: "Executive Room", price: "₹5,500 / night", perks: "Free Wi-Fi, Breakfast" },
            { type: "Standard Room", price: "₹3,500 / night", perks: "Queen Bed" }
          ]
        },
        { 
          name: "Hotel Gautam", rating: "3 Star", price: "Low Range", contact: "+91 99342 56789", address: "Station Road, Gaya", details: "Budget friendly stay for pilgrims and tourists.",
          rooms: [
            { type: "Standard Double", price: "₹1,800 / night", perks: "AC, Double Bed" },
            { type: "Basic Single", price: "₹900 / night", perks: "Fan only, Single Bed" }
          ]
        }
      ];
    } else if (distName === "Nalanda") {
      hotels = [
        { 
          name: "Indo Hokke Hotel", rating: "4 Star", price: "High Range", contact: "+91 611 225 5245", address: "Rajgir, Near Nalanda", details: "Japanese style hotel with serene environment.",
          rooms: [
            { type: "Japanese Suite", price: "₹8,500 / night", perks: "Tatami mats, AC, Breakfast" },
            { type: "Western Deluxe", price: "₹6,000 / night", perks: "King Bed, Garden View" }
          ]
        },
        { 
          name: "Hotel Nalanda Regency", rating: "3 Star", price: "Medium Range", contact: "+91 611 225 5566", address: "Rajgir Road, Nalanda", details: "Comfortable stay near the ruins.",
          rooms: [
            { type: "Executive Room", price: "₹4,000 / night", perks: "Queen Bed, AC" },
            { type: "Standard Room", price: "₹2,500 / night", perks: "Double Bed, Wi-Fi" }
          ]
        },
        { 
          name: "Ajatshatru Vihar", rating: "2 Star", price: "Low Range", contact: "+91 98765 12345", address: "Near Nalanda University Ruins", details: "Basic and affordable for students and budget travelers.",
          rooms: [
            { type: "Standard Double", price: "₹1,200 / night", perks: "AC, Double Bed" },
            { type: "Basic Room", price: "₹700 / night", perks: "Non-AC, Shared Bath" }
          ]
        }
      ];
    } else {
      // Default fallback
      hotels = [
        { 
          name: "Taj " + placeName + " Palace", rating: "5 Star", price: "High Range", contact: "+91 9876543210", address: "1 Main Road, Near " + placeName + ", " + distName, details: "Luxury stay with premium amenities, pool, and fine dining.",
          rooms: [
            { type: "Presidential Suite", price: "₹25,000 / night", perks: "Private Pool, Butler, King Bed" },
            { type: "Premium Deluxe", price: "₹12,000 / night", perks: "City View, King Bed, Free Breakfast" }
          ]
        },
        { 
          name: placeName + " Grand Hotel", rating: "4 Star", price: "Medium Range", contact: "+91 8765432109", address: "Station Road, Near " + placeName + ", " + distName, details: "Comfortable stay with great food and excellent service.",
          rooms: [
            { type: "Executive Suite", price: "₹7,500 / night", perks: "Lounge Access, Queen Bed" },
            { type: "Standard Deluxe", price: "₹4,000 / night", perks: "Queen Bed, Free Wi-Fi" }
          ]
        },
        { 
          name: "Hotel Relax " + placeName, rating: "3 Star", price: "Low Range", contact: "+91 7654321098", address: "Market Area, " + placeName + ", " + distName, details: "Affordable and clean basic accommodation.",
          rooms: [
            { type: "Standard Double", price: "₹2,000 / night", perks: "Double Bed, AC" },
            { type: "Basic Single", price: "₹1,200 / night", perks: "Single Bed, Non-AC" }
          ]
        }
      ];
    }

    return hotels.map(h => `
      <div class="rounded-md border border-border bg-card overflow-hidden mt-1">
        <button class="w-full flex items-center justify-between px-3 py-2 text-left text-sm font-semibold text-foreground hover:bg-accent transition-colors hotel-btn">
          <span class="flex items-center gap-2 max-w-[80%] truncate">
            <span class="truncate">${h.name}</span>
            <span class="flex-shrink-0 rounded-full bg-primary/20 text-primary px-2 py-0.5 text-[10px]">${h.rating}</span>
          </span>
          <i data-lucide="chevron-down" class="w-3.5 h-3.5 transition-transform duration-200 hotel-icon"></i>
        </button>
        <div class="hidden bg-background/50 overflow-hidden text-xs text-muted-foreground p-3 border-t border-border">
          <div class="mb-3">
            <p class="mb-1 flex items-start gap-1"><i data-lucide="map-pin" class="w-3 h-3 mt-0.5 text-primary"></i> <span class="text-gray-300">${h.address}</span></p>
            <p class="mb-1 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-primary"></i> <span class="text-gray-300">${h.contact}</span></p>
            <p class="mt-2 text-gray-400 italic">${h.details}</p>
          </div>
          
          <div class="border-t border-border/50 pt-3 mt-1">
            <p class="font-semibold text-foreground mb-2 text-[10px] uppercase tracking-wider">Room Plans & Pricing</p>
            <div class="space-y-2">
              ${h.rooms.map(r => `
                <div class="flex items-center justify-between bg-black/40 rounded-lg p-2 border border-border/60 shadow-inner">
                  <div>
                    <p class="font-bold text-gray-200 text-xs">${r.type}</p>
                    <p class="text-[10px] text-gray-500 mt-0.5">${r.perks}</p>
                    <p class="text-primary font-semibold text-xs mt-1.5">${r.price}</p>
                  </div>
                  <button onclick="window.location.href='booking.html?hotel=' + encodeURIComponent('${h.name.replace(/'/g, "\\'")}') + '&room=' + encodeURIComponent('${r.type.replace(/'/g, "\\'")}') + '&price=' + encodeURIComponent('${r.price}') + '&phone=' + encodeURIComponent('${h.contact}')" class="ml-2 px-3 py-1.5 flex-shrink-0 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground border border-primary/20 rounded-md text-[10px] tracking-wide uppercase font-bold transition-all shadow-sm active:scale-95">
                    Book
                  </button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </div>
    `).join('');
  }

  async function openPlacePopup(name, detail, dist, imageFromData) {
    currentPopupPlace = { name, dist, imageFromData };
    document.getElementById("popup-title").textContent = name;
    document.getElementById("popup-desc").textContent = detail;
    const q = name + ", " + dist + ", Bihar";
    document.getElementById("popup-directions").href = "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent(q);
    
    // Prepare for image load
    popupImage.style.opacity = "0";
    if (popupImageLoader) popupImageLoader.style.opacity = "1";
    
    // Setup and render Hotels
    const hotelsContainer = document.getElementById("popup-hotels-container");
    if (hotelsContainer) {
      hotelsContainer.innerHTML = '';
      hotelsContainer.classList.remove('hidden');
      
      const hotelsHTML = `
        <div class="mb-2 flex items-center gap-2">
          <span class="text-primary"><i data-lucide="bed" class="w-4 h-4"></i></span>
          <h5 class="font-heading text-xs font-semibold uppercase tracking-wider text-foreground">Nearby Hotels (High, Medium, Low)</h5>
        </div>
        <div class="space-y-2">
          ${getMocksHotelsHTML(name, dist)}
        </div>
      `;
      hotelsContainer.innerHTML = hotelsHTML;
      
      // Add toggles for hotels
      hotelsContainer.querySelectorAll('.hotel-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const content = e.currentTarget.nextElementSibling;
          const icon = e.currentTarget.querySelector('.hotel-icon');
          if(content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            if(icon) icon.style.transform = 'rotate(180deg)';
          } else {
            content.classList.add('hidden');
            if(icon) icon.style.transform = 'rotate(0deg)';
          }
        });
      });
    }

    // Show modal immediately so it doesn't freeze
    popup.classList.remove("opacity-0", "pointer-events-none");
    if (popupContent) popupContent.classList.remove("scale-95");
    lucide.createIcons();

    let imageUrl = imageFromData;

    if (!imageUrl) {
      // 1. Try to "research" the original image from Wikipedia
      imageUrl = await fetchOriginalPlaceImage(name, dist);

      // 2. Fallback to deterministic placeholder if no image found
      if (!imageUrl) {
         imageUrl = getDetermininsticImage(name);
      }
    }
    
    // Assign and animate the image
    const img = new Image();
    img.onload = () => {
      popupImage.src = imageUrl;
      popupImage.style.opacity = "1";
      if (popupImageLoader) popupImageLoader.style.opacity = "0";
    };
    img.onerror = () => {
      // Ultimate fallback just in case Wikipedia link is broken
      popupImage.src = getDetermininsticImage(name);
      popupImage.style.opacity = "1";
      if (popupImageLoader) popupImageLoader.style.opacity = "0";
    };
    img.src = imageUrl;
  }
  
  function closePlacePopup() {
    popup.classList.add("opacity-0", "pointer-events-none");
    if (popupContent) popupContent.classList.add("scale-95");
  }
  
  closePopupBtn.addEventListener("click", closePlacePopup);

  // Close when clicking outside the modal content
  popup.addEventListener("click", (e) => {
    if(e.target === popup) {
      closePlacePopup();
    }
  });

});
