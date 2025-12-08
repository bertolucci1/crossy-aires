/* ---------------- CONFIGURACIÓN DEL JUEGO ---------------- */
const CONFIG = {
    laneCount: 8, // 4 carriles ida + 4 vuelta
    laneWidth: 50,
    speedFactor: 1.5, // Multiplicador de velocidad global (aumentado)
    colors: {
        grass: 0x4caf50,
        road: 0x333333,
        markings: 0xffffff
    }
};

/* Ya no se usan los imports, el código está en este archivo
import { crearCerdo } from './cerdo.js';
import { crearGallina } from './gallina.js'; */
let scene, camera, renderer, menuBackgroundCamera;
let coinScene, coinCamera, coinRenderer, coinMesh;
let characterScene, characterCamera, characterRenderer;
let player;
let menuCerdo, menuGallina;
let worldGroup;
let lanes = [];
let vehicles = [];
let raycaster, mouse;
let inMenu = true;
let animationId;
let menuAnimationId;
let backgroundMusic;
let currentLevel = 1;
let playerCoins = 0;
let isGameOver = false;
let isFalling = false;
let currentAnimalType = 'cerdo'; // Default
let equippedSkin = 'default'; // Para recordar la skin elegida
let collisionSound, fallSound;

// Variables de movimiento
let targetPosition = { x: 0, z: 0 }; // La variable currentPosition no se usaba.

// Inicialización
function init() {
    // Escena y Fondo
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Cielo celeste

    // Cámara principal del juego
    const aspect = window.innerWidth / window.innerHeight;
    let d = 150; // Distancia de la cámara por defecto para escritorio
    const isMobileByUserAgent = /Mobi|Android|iPhone/i.test(navigator.userAgent);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isMobileByUserAgent || hasTouch || aspect < 1) { // Si es móvil, táctil o la ventana es vertical
        d = 400; // Aumentamos MÁS la distancia para que el cambio sea obvio
    }
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, -1000, 2000);
    camera.position.set(100, 100, 100); // Posición diagonal
    camera.lookAt(scene.position);

    // Cámara para el fondo del menú (rotatoria)
    const menuBgCamDistance = 350;
    menuBackgroundCamera = new THREE.OrthographicCamera(-menuBgCamDistance * aspect, menuBgCamDistance * aspect, menuBgCamDistance, -menuBgCamDistance, -1000, 2000);
    menuBackgroundCamera.position.set(0, 400, 0);
    menuBackgroundCamera.lookAt(scene.position);

    // Renderer
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // --- Escena y Renderer para los Personajes del Menú ---
    characterScene = new THREE.Scene();
    const characterCamDistance = 120;
    characterCamera = new THREE.OrthographicCamera(-characterCamDistance * aspect, characterCamDistance * aspect, characterCamDistance, -characterCamDistance, -1000, 2000);
    characterCamera.position.set(0, 50, 200);
    characterCamera.lookAt(characterScene.position);

    characterRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    characterRenderer.setSize(window.innerWidth, window.innerHeight);
    characterRenderer.domElement.className = 'character-canvas'; // Asignar clase para CSS
    const charContainer = document.getElementById('character-container');
    charContainer.appendChild(characterRenderer.domElement);


    // Luces
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(50, 100, 50);
    dirLight.castShadow = true;
    scene.add(dirLight);
    // Añadir luces también a la escena de personajes para que se vean bien
    characterScene.add(new THREE.AmbientLight(0xffffff, 0.7));
    characterScene.add(new THREE.DirectionalLight(0xffffff, 0.8).position.set(10, 50, 50));

    // Grupo para contener todos los objetos del mundo (mapa, edificios, etc.)
    worldGroup = new THREE.Group();
    scene.add(worldGroup);

    // Generar Mapa y Escenario para el fondo del menú
    generateMap();
    generateCityscape(); // Añadir edificios al menú
    // --- Personajes del Menú ---
    menuCerdo = createPigModel();
    menuCerdo.position.set(-50, 0, 0);
    characterScene.add(menuCerdo);

    menuGallina = createChickenModel();
    menuGallina.position.set(50, 0, 0);
    menuGallina.rotation.y = -Math.PI / 6;
    characterScene.add(menuGallina);

    // Crear el contador de monedas
    createCoinCounter();

    // Eventos de botones
    setupControls();

    // Asignar eventos a los botones del UI
    setupUI();

    // Configurar Raycaster para selección de personaje
    setupRaycasting();

    // --- Cargar Sonidos con Three.js ---
    const listener = new THREE.AudioListener();
    camera.add(listener); // Adjuntar el "oído" a la cámara
    const audioLoader = new THREE.AudioLoader();

    collisionSound = new THREE.Audio(listener);
    fallSound = new THREE.Audio(listener);

    audioLoader.load('sounds/collision.mp3', (buffer) => collisionSound.setBuffer(buffer));
    audioLoader.load('sounds/fall.mp3', (buffer) => fallSound.setBuffer(buffer));
    
    backgroundMusic = new THREE.Audio(listener);
    audioLoader.load('sounds/carretera.mp3', (buffer) => {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true);
        backgroundMusic.setVolume(0.3); // Ajusta el volumen de la música de fondo
    });
    
    // Iniciar la animación del menú
    menuAnimate();
}

// Generador de Mapa
function generateMap() {
    if (currentLevel < 3) {
        generateRichieriMap();
    } else {
        generateCiudadUniversitariaMap();
    }
}

// Generador para Autopista Richieri (Niveles 1 y 2)
function generateRichieriMap() {
    let currentZ = 0;

    // Suelo de la ciudad (se añade primero para que esté debajo de todo)
    const cityGroundGeo = new THREE.PlaneGeometry(2500, 10000); // Tamaño grande para cubrir todos los niveles
    const cityGroundMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const cityGround = new THREE.Mesh(cityGroundGeo, cityGroundMat);
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.y = -100;
    worldGroup.add(cityGround);

    // Zona de inicio (Pasto)
    createLane(currentZ, 'grass');
    currentZ += CONFIG.laneWidth;

    // Generar autopistas según el nivel
    for (let levelIndex = 0; levelIndex < currentLevel; levelIndex++) {
        // 4 carriles de ida
        for (let i = 0; i < 4; i++) {
            let direction = 1; // Derecha
            let speed = (Math.random() * 2 + 1) * direction * CONFIG.speedFactor * (1 + (currentLevel - 1) * 0.1);
            createLane(currentZ, 'road', speed);
            currentZ += CONFIG.laneWidth;
        }

        // Separador central
        createMedianStrip(currentZ);
        currentZ += CONFIG.laneWidth;

        // 4 carriles de vuelta
        for (let i = 0; i < 4; i++) {
            let direction = -1; // Izquierda
            let speed = (Math.random() * 2 + 1) * direction * CONFIG.speedFactor * (1 + (currentLevel - 1) * 0.1);
            createLane(currentZ, 'road', speed);
            currentZ += CONFIG.laneWidth;
        }

        // Zona de pasto intermedia (o final)
        createLane(currentZ, 'grass');
        currentZ += CONFIG.laneWidth;

        // Añadir cartel de autopista para este tramo
        createHighwaySign(currentZ - CONFIG.laneWidth); // Colocar el cartel en la zona segura
    }

    // Añadir barandillas a los lados de la autopista
    const guardRailZ1 = 0.5 * CONFIG.laneWidth;
    const guardRailZ2 = currentZ - 1.5 * CONFIG.laneWidth;
    createGuardRail(guardRailZ1);
    createGuardRail(guardRailZ2);

    // Generar el paisaje urbano para este nivel
    generateCityscape();
}

// Generador para Ciudad Universitaria (Nivel 3+)
function generateCiudadUniversitariaMap() {
    let currentZ = 0;
    
    // Suelo de pasto verde para el nivel
    const cityGroundGeo = new THREE.PlaneGeometry(2500, 10000);
    const cityGroundMat = new THREE.MeshLambertMaterial({ color: CONFIG.colors.grass });
    const cityGround = new THREE.Mesh(cityGroundGeo, cityGroundMat);
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.y = -6; // Un poco por debajo de las calles
    worldGroup.add(cityGround);

    // Zona de inicio (Pasto)
    createLane(currentZ, 'grass');
    currentZ += CONFIG.laneWidth;

    // El número de "secciones" de C.U. aumenta con el nivel
    const cuSections = currentLevel - 2; 

    for (let sectionIndex = 0; sectionIndex < cuSections; sectionIndex++) {
        const sectionStartZ = currentZ;
        // --- Av. Leopoldo Lugones --- (Cartel al principio)
        createHighwaySign(currentZ - CONFIG.laneWidth, "AV. Leopoldo Lugones", 0.9); // Cartel más pequeño
        for (let i = 0; i < 4; i++) {
            let speed = (Math.random() * 2 + 2) * 1 * CONFIG.speedFactor;
            createLane(currentZ, 'road', speed);
            currentZ += CONFIG.laneWidth;
        }

        // Añadir un camino peatonal antes de las vías
        createLane(currentZ, 'grass');
        currentZ += CONFIG.laneWidth;

        const trainTracksStartZ = currentZ;
        createTrainTrack(currentZ, 15); // Vía 1, velocidad 15
        currentZ += CONFIG.laneWidth;
        createTrainTrack(currentZ, -15); // Vía 2, velocidad -15
        currentZ += CONFIG.laneWidth;

        // Añadir una estación de tren en cada sección de vías
        const trainTracksCenterZ = trainTracksStartZ + CONFIG.laneWidth; // Centro entre las 2 vías
        createTrainStation(trainTracksCenterZ);

        // Añadir el puente peatonal que empieza antes de las vías y cruza Cantilo
        createPedestrianBridge(trainTracksStartZ - CONFIG.laneWidth, trainTracksStartZ);

        createLane(currentZ, 'grass'); // Pasto después de las vías
        currentZ += CONFIG.laneWidth;

        // --- Av. Int. Cantilo ---
        for (let i = 0; i < 4; i++) {
            let speed = (Math.random() * 2 + 2) * -1 * CONFIG.speedFactor;
            createLane(currentZ, 'road', speed);
            currentZ += CONFIG.laneWidth;
        }

        // Zona de pasto intermedia y cartel de Cantilo
        createLane(currentZ, 'grass');
        createHighwaySign(currentZ, "AV. Int Cantilo", 0.9); // Cartel más pequeño
        currentZ += CONFIG.laneWidth;
    }

    // Barandillas
    const guardRailZ1 = 0.5 * CONFIG.laneWidth;
    const guardRailZ2 = currentZ - 1.5 * CONFIG.laneWidth;
    createGuardRail(guardRailZ1);
    createGuardRail(guardRailZ2);

    // Generar el paisaje urbano para este nivel
    generateCityscape();
}

// Crear un carril
function createLane(zPos, type, speed = 0) {
    const laneGeo = new THREE.BoxGeometry(2000, 10, CONFIG.laneWidth);
    let laneMat;

    if (type === 'grass') {
        // Ahora es una senda peatonal
        laneMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb });
        const laneMesh = new THREE.Mesh(laneGeo, laneMat);
        laneMesh.position.set(0, -5, zPos);
        laneMesh.receiveShadow = true;
        worldGroup.add(laneMesh);

        // Líneas de borde amarillas para la senda peatonal
        const borderLineGeo = new THREE.BoxGeometry(2000, 2, 4);
        const borderLineMat = new THREE.MeshLambertMaterial({ color: 0xffff00 });
        const border1 = new THREE.Mesh(borderLineGeo, borderLineMat);
        border1.position.set(0, 1, zPos - CONFIG.laneWidth / 2 + 2);
        const border2 = new THREE.Mesh(borderLineGeo, borderLineMat);
        border2.position.set(0, 1, zPos + CONFIG.laneWidth / 2 - 2);
        worldGroup.add(border1, border2);

        lanes.push({ z: zPos, type: type }); // Guardar referencia para la lógica de las líneas
        return; // No necesita más decoración
    }

    const laneMesh = new THREE.Mesh(laneGeo, new THREE.MeshLambertMaterial({ color: CONFIG.colors.road }));
    laneMesh.position.set(0, -5, zPos); // Nivel de la autopista
    laneMesh.receiveShadow = true;
    worldGroup.add(laneMesh);

    // Si es calle, agregar líneas y autos
    if (type === 'road') {
        // Líneas punteadas
        const lineGeo = new THREE.PlaneGeometry(20, 5);
        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        for(let x = -950; x < 950; x+=100) { // Extendido para el nuevo ancho
            const line = new THREE.Mesh(lineGeo, lineMat);
            line.rotation.x = -Math.PI / 2;
            line.position.set(x, 0.1, zPos);
            worldGroup.add(line);
        }

        // Agregar vehículos al carril
        if (speed !== 0) { // Solo generar vehículos en carriles con movimiento
            let carCount = Math.floor(Math.random() * 3) + 2; // Ahora entre 2 y 4 vehículos por carril
            for(let k=0; k<carCount; k++) {
                let offset = (Math.random() * 1800) - 900; // Rango de aparición más amplio
                spawnVehicle(zPos, speed, offset);
            }
        }

        // Guardar referencia del carril para la lógica de las líneas amarillas
        lanes.push({ z: zPos, type: type });
    }
}

// Crear vía de tren
function createTrainTrack(zPos, speed) {
    // Base de la vía (grava/tierra para evitar el parpadeo de las líneas de la carretera)
    const trackBedGeo = new THREE.BoxGeometry(2000, 10, CONFIG.laneWidth);
    const trackBedMat = new THREE.MeshLambertMaterial({ color: 0x6B4F3A }); // Color tierra/grava
    const trackBed = new THREE.Mesh(trackBedGeo, trackBedMat);
    trackBed.position.set(0, -5, zPos);
    trackBed.receiveShadow = true;
    worldGroup.add(trackBed);

    // Rieles
    const railGeo = new THREE.BoxGeometry(2000, 2, 4);
    const railMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    
    const rail1 = new THREE.Mesh(railGeo, railMat);
    rail1.position.set(0, 1, zPos - 10);
    worldGroup.add(rail1);

    const rail2 = new THREE.Mesh(railGeo, railMat);
    rail2.position.set(0, 1, zPos + 10);
    worldGroup.add(rail2);

    // Durmientes
    const sleeperGeo = new THREE.BoxGeometry(30, 2, 4);
    for (let x = -990; x < 1000; x += 20) {
        const sleeper = new THREE.Mesh(sleeperGeo, trackBedMat);
        sleeper.position.set(x, 0, zPos);
        worldGroup.add(sleeper);
    }

    // Generar un tren para esta vía
    spawnTrain(zPos, speed, Math.random() * 1800 - 900);

    // Guardar referencia del carril para la lógica de las líneas amarillas
    lanes.push({ z: zPos, type: 'track' });
}

// Crear estación de tren para Nivel 3
function createTrainStation(zPos) {
    const stationGroup = new THREE.Group();

    // 1. Plataforma
    const platformGeo = new THREE.BoxGeometry(500, 10, CONFIG.laneWidth * 4); // Más ancha y profunda
    const platformMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.set(0, -5.1, zPos); // Ligeramente hundida para evitar z-fighting
    stationGroup.add(platform);

    // 2. Techo con textura celeste y blanco
    const roofCanvas = document.createElement('canvas');
    roofCanvas.width = 256;
    roofCanvas.height = 256;
    const roofCtx = roofCanvas.getContext('2d');
    const stripeHeight = 32;
    for (let i = 0; i < roofCanvas.height / stripeHeight; i++) {
        roofCtx.fillStyle = i % 2 === 0 ? '#75AADB' : '#FFFFFF'; // Celeste y Blanco
        roofCtx.fillRect(0, i * stripeHeight, roofCanvas.width, stripeHeight);
    }
    const roofTexture = new THREE.CanvasTexture(roofCanvas);
    roofTexture.wrapS = THREE.RepeatWrapping;
    roofTexture.wrapT = THREE.RepeatWrapping;
    roofTexture.repeat.set(4, 1);

    const roofGeo = new THREE.BoxGeometry(520, 8, 150); // Techo más grande
    const roofMat = new THREE.MeshLambertMaterial({ map: roofTexture, side: THREE.FrontSide }); // Renderizar solo la cara de arriba
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, 50, zPos);
    stationGroup.add(roof);

    // 3. Postes de soporte
    const postGeo = new THREE.CylinderGeometry(4, 4, 50, 8);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
    const postPositions = [-180, 180];
    postPositions.forEach(x => {
        const post1 = new THREE.Mesh(postGeo, postMat);
        post1.position.set(x, 20, zPos + 60);
        const post2 = new THREE.Mesh(postGeo, postMat);
        post2.position.set(x, 20, zPos - 60);
        stationGroup.add(post1, post2);
    });

    // 4. Cartel de la estación
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512; signCanvas.height = 128;
    const signCtx = signCanvas.getContext('2d');
    signCtx.fillStyle = '#003366'; // Azul oscuro
    signCtx.fillRect(0, 0, signCanvas.width, signCanvas.height);
    signCtx.fillStyle = 'white';
    signCtx.font = 'bold 50px Arial';
    signCtx.textAlign = 'center';
    signCtx.textBaseline = 'middle';
    signCtx.fillText('Ciudad Universitaria', signCanvas.width / 2, signCanvas.height / 2);
    const signTexture = new THREE.CanvasTexture(signCanvas);
    const signGeo = new THREE.PlaneGeometry(200, 50);
    const signMesh = new THREE.Mesh(signGeo, new THREE.MeshBasicMaterial({ map: signTexture }));
    signMesh.position.set(0, 65, zPos - 75); // Sobre el techo, de cara al jugador
    stationGroup.add(signMesh);

    worldGroup.add(stationGroup);
}

// Crear puente peatonal para Ciudad Universitaria
function createPedestrianBridge(zStartPos, tracksZ) {
    const bridgeGroup = new THREE.Group();
    const bridgeMat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
    const railMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

    const floorHeight = 80;
    const rampLength = 200;
    const flatLength = CONFIG.laneWidth * 6; // Longitud para cruzar Cantilo y la zona de pasto

    // 1. Marco de entrada celeste
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x75AADB });
    const frameBeamGeo = new THREE.BoxGeometry(100, 10, 10);
    const framePostGeo = new THREE.BoxGeometry(10, floorHeight + 10, 10);
    
    const topBeam = new THREE.Mesh(frameBeamGeo, frameMat);
    topBeam.position.set(0, floorHeight + 5, zStartPos);
    const post1 = new THREE.Mesh(framePostGeo, frameMat);
    post1.position.set(-45, floorHeight/2, zStartPos);
    const post2 = new THREE.Mesh(framePostGeo, frameMat);
    post2.position.set(45, floorHeight/2, zStartPos);
    bridgeGroup.add(topBeam, post1, post2);

    // 2. Sección plana sobre la autopista (ahora extendida, sin rampa)
    const totalBridgeLength = rampLength + flatLength;
    const flatSectionZ = zStartPos + totalBridgeLength / 2;
    const flatGeo = new THREE.BoxGeometry(80, 5, totalBridgeLength);
    const flatSection = new THREE.Mesh(flatGeo, bridgeMat);
    flatSection.position.set(0, floorHeight, flatSectionZ);
    bridgeGroup.add(flatSection);

    // 3. Barandillas (ahora cubren toda la longitud)
    const railGeo = new THREE.BoxGeometry(2, 15, totalBridgeLength);
    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(-38, floorHeight + 5, flatSectionZ);
    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(38, floorHeight + 5, flatSectionZ);
    bridgeGroup.add(leftRail, rightRail);

    // 4. Pilares de soporte
    const pillarGeo = new THREE.CylinderGeometry(10, 10, floorHeight, 12);
    
    // Pilar después de las vías del tren
    const pillar1Z = tracksZ + CONFIG.laneWidth * 3;
    const pillar1 = new THREE.Mesh(pillarGeo, pillarMat);
    pillar1.position.set(0, floorHeight / 2, pillar1Z);
    bridgeGroup.add(pillar1);

    // Pilar después de Av. Cantilo
    const pillar2Z = pillar1Z + CONFIG.laneWidth * 5;
    const pillar2 = new THREE.Mesh(pillarGeo, pillarMat);
    pillar2.position.set(0, floorHeight / 2, pillar2Z);
    bridgeGroup.add(pillar2);


    bridgeGroup.position.x = -350; // Mover el puente a un costado de la estación
    worldGroup.add(bridgeGroup);
}

// Crear el separador central de la autopista con farolas
function createMedianStrip(zPos) {
    const barrierWidth = CONFIG.laneWidth / 4;
    const medianLength = 2000; // Más ancho

    // Crear dos barreras de concreto con luces
    [-barrierWidth, barrierWidth].forEach(offset => {
        // Base de concreto
        const medianGeo = new THREE.BoxGeometry(medianLength, 15, barrierWidth);
        const medianMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const median = new THREE.Mesh(medianGeo, medianMat);
        median.position.set(0, 7.5, zPos + offset);
        median.receiveShadow = true;
        worldGroup.add(median);

        // Farolas sobre la barrera
        const poleGeo = new THREE.CylinderGeometry(2, 2, 40, 8);
        const poleMat = new THREE.MeshLambertMaterial({ color: 0x555555 });

        for (let x = -950; x < 950; x += 150) { // Extendido
            const pole = new THREE.Mesh(poleGeo, poleMat);
            pole.position.set(x, 20, zPos + offset);
            pole.castShadow = true;
            worldGroup.add(pole);

            // Luz de la farola
            const light = new THREE.PointLight(0xffddaa, 0.7, 100, 2); // Color, intensidad, distancia, decaimiento
            light.position.set(x, 45, zPos + offset);
            worldGroup.add(light);
        }
    });

    // El suelo del carril central (para que no se vea el pasto)
    // createLane(zPos, 'road'); // Eliminado para evitar conflicto con las vías
}

// Crear barandillas laterales
function createGuardRail(zPos) {
    const railLength = 2000;
    const railHeight = 15;
    const railDepth = 5;

    const railGeo = new THREE.BoxGeometry(railLength, railHeight, railDepth);
    const railMat = new THREE.MeshLambertMaterial({ color: 0xaaaaaa });
    const rail = new THREE.Mesh(railGeo, railMat);
    rail.position.set(0, 7.5, zPos);
    worldGroup.add(rail);
}

// --- NUEVO SISTEMA DE EDIFICIOS ---

// 1. Función para crear un único edificio
function createBuilding(x, z) {
    const buildingGroup = new THREE.Group();

    // Dimensiones y color aleatorios
    const height = Math.random() * 150 + 50; // Altura controlada para no molestar la cámara
    const width = Math.random() * 80 + 60;
    const depth = Math.random() * 80 + 60;
    const buildingColors = [0x8B4513, 0xA0522D, 0xBC8F8F, 0x696969, 0x778899];
    const color = buildingColors[Math.floor(Math.random() * buildingColors.length)];

    const buildingMat = new THREE.MeshLambertMaterial({ color: color });
    const buildingGeo = new THREE.BoxGeometry(width, height, depth);
    const building = new THREE.Mesh(buildingGeo, buildingMat);

    building.castShadow = true;
    buildingGroup.add(building);

    // Posicionar el edificio
    const groundY = currentLevel < 3 ? -100 : -6; // Nivel del suelo según el mapa
    buildingGroup.position.set(x, groundY + height / 2, z);

    worldGroup.add(buildingGroup);
}

// 2. Función para generar el paisaje urbano a los costados
function generateCityscape() {
    // Encontrar los límites Z de la autopista para colocar los edificios a los lados
    if (lanes.length === 0) return;

    const zPositions = lanes.map(lane => lane.z);
    const minZ = Math.min(...zPositions);
    const maxZ = Math.max(...zPositions);
    const sideOffset = 250; // Distancia desde el borde de la autopista

    // Generar edificios a lo largo del mapa
    for (let x = -1000; x < 1000; x += 150) { // Generar edificios a lo ancho
        // Lado "antes" de la autopista (cerca del jugador)
        createBuilding(x + Math.random() * 100, minZ - sideOffset - Math.random() * 300);
        // Lado "después" de la autopista (lejos del jugador)
        createBuilding(x + Math.random() * 100, maxZ + sideOffset + Math.random() * 300);
    }
}

// Crear cartel de autopista
function createHighwaySign(zPos, text = 'AU. Richieri', scale = 1) {
    const signStructure = new THREE.Group();

    // --- Textura del Cartel ---
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 512;
    canvas.height = 128;
    context.fillStyle = '#006A4E'; // Verde de cartel de autopista
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = 'white';

    // Ajustar tamaño de fuente según la longitud del texto
    let fontSize = 55;
    if (text.length > 18) {
        fontSize = 45; // Usar una fuente más pequeña para textos muy largos
    }
    context.font = `bold ${fontSize}px Arial`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);
    const texture = new THREE.CanvasTexture(canvas);

    // --- Geometrías y Materiales (reutilizables) ---
    const signMaterial = new THREE.MeshBasicMaterial({ map: texture });
    const signGeometry = new THREE.PlaneGeometry(400 * scale, 75 * scale);
    const postGeo = new THREE.CylinderGeometry(8 * scale, 8 * scale, 120 * scale, 12);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x777777 });
    const beamGeo = new THREE.BoxGeometry(450 * scale, 10 * scale, 10 * scale);

    // --- Construcción del Pórtico ---
    // Postes verticales
    const postLeft = new THREE.Mesh(postGeo, postMat);
    postLeft.position.set(-220 * scale, 50 * scale, 0);
    const postRight = new THREE.Mesh(postGeo, postMat);
    postRight.position.set(220 * scale, 50 * scale, 0);

    // Viga horizontal
    const beam = new THREE.Mesh(beamGeo, postMat);
    beam.position.y = 120 * scale; // Subir la viga para que no atraviese el cartel

    // El cartel en sí, colgando de la viga
    const signMesh = new THREE.Mesh(signGeometry, signMaterial);
    signMesh.position.y = 80 * scale; // Bajar el cartel para que cuelgue de la viga

    signStructure.add(postLeft, postRight, beam, signMesh);
    signStructure.position.set(0, 0, zPos); // Centrado en X, en la Z de la senda peatonal
    worldGroup.add(signStructure);
}



// Crear Vehículo (Caja + Ruedas)
function spawnVehicle(z, speed, xOffset) {
    const vehicleGroup = new THREE.Group();
    
    // Aleatoriedad: Camión o Auto
    let isTruck = Math.random() > 0.7;
    let width = isTruck ? 60 : 30;
    let height = 20;
    let depth = 20;
    let color = Math.random() * 0xffffff;

    // Cuerpo (Caja simple)
    const bodyGeo = new THREE.BoxGeometry(width, height, depth);
    const bodyMat = new THREE.MeshLambertMaterial({ color: color });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.position.y = 10;
    vehicleGroup.add(body);

    // Ruedas (Cilindros simples)
    const wheelGeo = new THREE.CylinderGeometry(5, 5, 22, 8);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    
    let wheelX = width / 2 - 5;
    let wheelPositions = [-wheelX, wheelX];
    
    wheelPositions.forEach(x => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 5, 0);
        vehicleGroup.add(wheel);
    });

    // Configuración inicial
    vehicleGroup.position.set(xOffset, 0, z);
    
    // Guardamos datos para la animación
    vehicleGroup.userData = { speed: speed, width: width, depth: depth };
    
    worldGroup.add(vehicleGroup);
    vehicles.push(vehicleGroup);
}

// Crear Tren
function spawnTrain(z, speed, xOffset) {
    const trainGroup = new THREE.Group();
    let trainColor = 0xAAAAAA; // Gris por defecto
    let wagonColor = 0x888888; // Gris oscuro por defecto

    // Colores especiales para el Nivel 3
    if (currentLevel >= 3) {
        trainColor = 0x75AADB; // Celeste
        wagonColor = 0xFFFFFF; // Blanco
    }

    const trainMat = new THREE.MeshLambertMaterial({ color: trainColor });

    // Locomotora
    const engineGeo = new THREE.BoxGeometry(80, 30, 25);
    const engine = new THREE.Mesh(engineGeo, trainMat);
    engine.position.set(speed > 0 ? -45 : 45, 15, 0); // La locomotora siempre va adelante
    engine.castShadow = true;
    trainGroup.add(engine);

    // Vagones (simples)
    for (let i = 0; i < 3; i++) {
        const wagonGeo = new THREE.BoxGeometry(100, 25, 25);
        const wagon = new THREE.Mesh(wagonGeo, new THREE.MeshLambertMaterial({ color: wagonColor }));
        wagon.position.set((speed > 0 ? i * 110 : -i * 110), 12.5, 0);
        trainGroup.add(wagon);
    }

    trainGroup.position.set(xOffset, 0, z);
    trainGroup.userData = { speed: speed, width: 450, depth: 25 }; // Ancho total aproximado
    worldGroup.add(trainGroup);
    vehicles.push(trainGroup); // Los trenes también son "vehículos" para la colisión
}

// --- CONTADOR DE MONEDAS ---
function createCoinCounter() {
    const container = document.getElementById('coin-icon-container');
    coinScene = new THREE.Scene();

    // Cámara para la moneda
    const aspect = container.clientWidth / container.clientHeight;
    coinCamera = new THREE.PerspectiveCamera(50, aspect, 0.1, 1000);
    coinCamera.position.z = 30;

    // Renderer para la moneda
    coinRenderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    coinRenderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(coinRenderer.domElement);

    // Luz para la moneda
    const coinLight = new THREE.DirectionalLight(0xffffff, 1);
    coinLight.position.set(5, 10, 7.5);
    coinScene.add(coinLight);
    coinScene.add(new THREE.AmbientLight(0xffffff, 0.5));

    // Modelo de la moneda
    coinMesh = createCoinModel();
    coinScene.add(coinMesh);
}

function createCoinModel() {
    const coinGroup = new THREE.Group();
    const coinGeo = new THREE.CylinderGeometry(10, 10, 4, 16);
    const coinMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, metalness: 0.5, roughness: 0.5 });
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xDAA520, metalness: 0.5, roughness: 0.5 });

    const coin = new THREE.Mesh(coinGeo, [edgeMat, coinMat, coinMat]); // Lado, Tapa, Fondo
    coin.rotation.x = Math.PI / 2;

    return coin;
}

function createPigModel(showSkin = true) {
    const pig = new THREE.Group();
    const pigColor = 0xffaec9;
    const pigMaterial = new THREE.MeshLambertMaterial({ color: pigColor });

    const bodyGeo = new THREE.BoxGeometry(20, 18, 30);
    const body = new THREE.Mesh(bodyGeo, pigMaterial);
    body.name = 'body';
    body.position.y = 15;
    body.castShadow = true;
    pig.add(body);

    const shirtGroup = new THREE.Group();
    shirtGroup.name = 'shirt';
    const bocaBlue = 0x003399;
    const bocaGold = 0xFFCC00;
    const shirtHeight = 18.5;
    const stripeHeight = shirtHeight / 2.5;
    const bluePartHeight = (shirtHeight - stripeHeight) / 2;
    const topBluePart = new THREE.Mesh(new THREE.BoxGeometry(20.5, bluePartHeight, 30.5), new THREE.MeshLambertMaterial({ color: bocaBlue }));
    topBluePart.position.y = 15 + (stripeHeight / 2) + (bluePartHeight / 2);
    shirtGroup.add(topBluePart);
    const goldStripe = new THREE.Mesh(new THREE.BoxGeometry(20.5, stripeHeight, 30.5), new THREE.MeshLambertMaterial({ color: bocaGold }));
    goldStripe.position.y = 15;
    shirtGroup.add(goldStripe);
    const bottomBluePart = new THREE.Mesh(new THREE.BoxGeometry(20.5, bluePartHeight, 30.5), new THREE.MeshLambertMaterial({ color: bocaBlue }));
    bottomBluePart.position.y = 15 - (stripeHeight / 2) - (bluePartHeight / 2);
    shirtGroup.add(bottomBluePart);
    shirtGroup.visible = showSkin;
    pig.add(shirtGroup);

    const headGeo = new THREE.BoxGeometry(18, 18, 18);
    const head = new THREE.Mesh(headGeo, pigMaterial);
    head.position.set(0, 26, 12);
    pig.add(head);

    const snoutGeo = new THREE.BoxGeometry(10, 8, 5);
    const snout = new THREE.Mesh(snoutGeo, new THREE.MeshLambertMaterial({ color: 0xfcd1d1 }));
    snout.position.set(0, 24, 22);
    pig.add(snout);

    const eyeGeo = new THREE.BoxGeometry(3, 3, 2);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(5, 28, 21);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-5, 28, 21);
    pig.add(leftEye, rightEye);

    const legGeo = new THREE.BoxGeometry(6, 10, 6);
    const legPositions = [{ x: 7, z: 10 }, { x: -7, z: 10 }, { x: 7, z: -10 }, { x: -7, z: -10 }];
    legPositions.forEach(pos => {
        const leg = new THREE.Mesh(legGeo, pigMaterial);
        leg.position.set(pos.x, 5, pos.z);
        pig.add(leg);
    });

    return pig;
}

function createChickenModel(showSkin = true) {
    const chicken = new THREE.Group();
    const chickenMaterial = new THREE.MeshLambertMaterial({ color: 0xEAEAEA });

    const bodyGeo = new THREE.BoxGeometry(18, 22, 16);
    const body = new THREE.Mesh(bodyGeo, chickenMaterial);
    body.name = 'body';
    body.position.y = 12;
    body.castShadow = true;
    chicken.add(body);

    const riverShirtGeo = new THREE.BoxGeometry(18.5, 22.5, 16.5);
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 256;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 256, 256);
    context.strokeStyle = '#D60000';
    context.lineWidth = 60;
    context.beginPath();
    context.moveTo(0, 256);
    context.lineTo(256, 0);
    context.stroke();
    const riverTexture = new THREE.CanvasTexture(canvas);
    const frontMaterial = new THREE.MeshLambertMaterial({ map: riverTexture });
    const whiteMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const riverShirtMaterials = [whiteMaterial, whiteMaterial, whiteMaterial, whiteMaterial, frontMaterial, whiteMaterial];
    const riverShirt = new THREE.Mesh(riverShirtGeo, riverShirtMaterials);
    riverShirt.name = 'river_shirt';
    riverShirt.position.y = 12;
    riverShirt.visible = showSkin;
    chicken.add(riverShirt);

    const headGeo = new THREE.BoxGeometry(14, 14, 14);
    const head = new THREE.Mesh(headGeo, chickenMaterial);
    head.position.set(0, 26, 0);
    chicken.add(head);

    const beakGeo = new THREE.BoxGeometry(4, 4, 6);
    const beak = new THREE.Mesh(beakGeo, new THREE.MeshLambertMaterial({ color: 0xffa500 }));
    beak.position.set(0, 25, 8);
    chicken.add(beak);

    const wattleGeo = new THREE.BoxGeometry(4, 5, 2);
    const wattle = new THREE.Mesh(wattleGeo, new THREE.MeshLambertMaterial({ color: 0xff0000 }));
    wattle.position.set(0, 21, 8);
    chicken.add(wattle);

    const crestGeo = new THREE.BoxGeometry(4, 6, 8);
    const crest = new THREE.Mesh(crestGeo, new THREE.MeshLambertMaterial({ color: 0xff0000 }));
    crest.position.set(0, 34, 0);
    chicken.add(crest);

    const eyeGeo = new THREE.BoxGeometry(2, 2, 2);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(4, 28, 5);
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(-4, 28, 5);
    chicken.add(leftEye, rightEye);

    const legGeo = new THREE.BoxGeometry(4, 8, 4);
    const legMat = new THREE.MeshLambertMaterial({ color: 0xffa500 });
    const leftLeg = new THREE.Mesh(legGeo, legMat);
    leftLeg.position.set(5, 4, 0);
    const rightLeg = new THREE.Mesh(legGeo, legMat);
    rightLeg.position.set(-5, 4, 0);
    chicken.add(leftLeg, rightLeg);

    return chicken;
}

function createPlayer(type) {
    if (player) scene.remove(player);

    if (type === 'cerdo') {
        player = createPigModel(false); // Inicia sin skin
    } else if (type === 'gallina') {
        player = createChickenModel(false); // Inicia sin skin
    }

    // Posición inicial
    targetPosition = { x: 0, z: 0 };
    player.position.set(0, 0, 0);
    scene.add(player);

    // Enfocar cámara
    camera.position.x = player.position.x + 100;
    camera.position.z = player.position.z + 100;
}

// Bucle de animación para el menú
function menuAnimate() {
    // 1. Renderizar el fondo (mundo del juego rotando)
    const time = Date.now() * 0.0002;
    menuBackgroundCamera.position.x = Math.cos(time) * 300;
    menuBackgroundCamera.position.z = Math.sin(time) * 300;
    menuBackgroundCamera.lookAt(scene.position);
    renderer.render(scene, menuBackgroundCamera);

    // 2. Renderizar los personajes en su propia escena
    if (menuCerdo) menuCerdo.rotation.y += 0.01;
    if (menuGallina) menuGallina.rotation.y += 0.01;
    characterRenderer.clear(); // Limpiar el renderer de personajes antes de dibujar
    characterRenderer.render(characterScene, characterCamera);

    // 3. Renderizar el contador de monedas por separado
    if (coinMesh) coinMesh.rotation.y += 0.02; // Rotar la moneda del contador
    if (coinRenderer) coinRenderer.render(coinScene, coinCamera);

    menuAnimationId = requestAnimationFrame(menuAnimate);
}

// Bucle del Juego
function animate() {
    if (isGameOver) {
        return; // Detiene el bucle si el juego ha terminado
    }

    updateVehicles();
    updatePlayer();
    updateCamera();
    checkGameState();

    if (coinMesh) coinMesh.rotation.y += 0.02;
    if (coinRenderer) coinRenderer.render(coinScene, coinCamera);

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
}

function updateVehicles() {
    vehicles.forEach(v => {
        v.position.x += v.userData.speed;
        
        // Loop infinito de autos
        if (v.position.x > 1000) v.position.x = -1000;
        if (v.position.x < -1000) v.position.x = 1000;

        // DETECCION DE COLISIÓN (AABB simple)
        let distZ = Math.abs(player.position.z - v.position.z);
        let distX = Math.abs(player.position.x - v.position.x);
        if (distZ < 15 && distX < (v.userData.width / 2 + 10)) {
            gameOver();
        }
    });
}

function updatePlayer() {
    // Suavizar movimiento del jugador (Lerp)
    player.position.x += (targetPosition.x - player.position.x) * 0.2;
    player.position.z += (targetPosition.z - player.position.z) * 0.2;

    // Animación de caída
    if (isFalling) {
        player.position.y -= 5; // Velocidad de caída
        player.rotation.x += 0.05; // Rotación mientras cae hacia atrás
    }
}

function updateCamera() {
    camera.position.x += ((targetPosition.x + 100) - camera.position.x) * 0.1;
    camera.position.z += ((targetPosition.z + 100) - camera.position.z) * 0.1;
    camera.lookAt(player.position.x, 0, player.position.z);
}

function checkGameState() {
    // Chequear victoria
    let winZ;
    if (currentLevel < 3) {
        winZ = currentLevel * 10 * CONFIG.laneWidth;
    } else {
        winZ = ((currentLevel - 2) * 12 * CONFIG.laneWidth) + CONFIG.laneWidth; // 12 carriles por sección de C.U.
    }
    if (player.position.z >= winZ) {
        winGame();
    }
    // Chequear si se cae
    if (player.position.z < -CONFIG.laneWidth / 4 && !isFalling) {
        isFalling = true;
        setTimeout(fallOff, 2000);
    }
}

// Controles y Lógica de Movimiento
function move(direction) {
    if (isGameOver) return;

    const step = CONFIG.laneWidth; // Saltar un carril o distancia lateral
    
    switch(direction) {
        case 'forward': 
            targetPosition.z += step; 
            break;
        case 'backward': targetPosition.z -= step; break; // Permitir retroceder al vacío
        case 'left': targetPosition.x -= step; break;  // Invertido para que sea intuitivo
        case 'right': targetPosition.x += step; break; // Invertido para que sea intuitivo
    }
    
    // Efecto de salto (simple)
    player.position.y = 20;
    setTimeout(() => { player.position.y = 0; }, 100);
}

function setupControls() {
    document.getElementById('btn-forward').addEventListener('click', () => move('forward'));
    document.getElementById('btn-backward').addEventListener('click', () => move('backward'));
    document.getElementById('btn-left').addEventListener('click', () => move('left'));
    document.getElementById('btn-right').addEventListener('click', () => move('right'));

    // Teclado también
    window.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowUp') move('forward');
        if (e.key === 'ArrowDown') move('backward');
        if (e.key === 'ArrowLeft') move('left');
        if (e.key === 'ArrowRight') move('right');
    });
}

// Configurar Raycaster para detectar clics en los personajes del menú
function setupRaycasting() {
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
 
    function handleInteraction(x, y) {
        if (!inMenu) return; // Solo funciona en el menú
 
        // IMPORTANTE: Chequear si el clic fue en un botón de la UI antes de procesar el raycast.
        // Esto evita que el canvas de los personajes "robe" los clics de los botones.
        const clickedElement = document.elementFromPoint(x, y);
        if (clickedElement && clickedElement.tagName === 'BUTTON') {
            return; // Si se hizo clic en un botón, no hacer nada más aquí.
        }

        // Normalizar coordenadas del mouse/touch (-1 a +1)
        mouse.x = (x / window.innerWidth) * 2 - 1;
        mouse.y = - (y / window.innerHeight) * 2 + 1;
 
        raycaster.setFromCamera(mouse, characterCamera); // Usar la cámara de los personajes
 
        const intersects = raycaster.intersectObjects([menuCerdo, menuGallina], true);
 
        if (intersects.length > 0) {
            let clickedObject = intersects[0].object;
            // Subir en la jerarquía hasta encontrar el grupo principal del personaje
            while (clickedObject.parent && !clickedObject.parent.isScene) {
                clickedObject = clickedObject.parent;
            }
 
            if (clickedObject === menuCerdo) {
                startGame('cerdo');
            } else if (clickedObject === menuGallina) {
                startGame('gallina');
            }
        }
    }

    window.addEventListener('mousedown', (event) => {
        handleInteraction(event.clientX, event.clientY);
    });

    window.addEventListener('touchstart', (event) => {
        handleInteraction(event.touches[0].clientX, event.touches[0].clientY);
    }, { passive: true }); // Usar passive: true para mejor rendimiento en móviles
}

// Asignar eventos a los botones del menú y pantallas
function setupUI() {
    document.getElementById('btn-skin-boca').addEventListener('click', () => applySkin('camiseta_futbol'));
    document.getElementById('btn-skin-river').addEventListener('click', () => applySkin('camiseta_river'));
    document.getElementById('btn-skin-gala').addEventListener('click', () => applySkin('gala'));
    document.getElementById('btn-next-level').addEventListener('click', goToNextLevel);
    document.getElementById('btn-reset-reward').addEventListener('click', resetGame);
    document.getElementById('btn-restart-to-menu').addEventListener('click', () => resetGame(false));
    document.getElementById('btn-reset-gameover').addEventListener('click', resetGame);

    document.getElementById('btn-level-1').addEventListener('click', () => selectLevel(1));
    document.getElementById('btn-level-2').addEventListener('click', () => selectLevel(2));
    document.getElementById('btn-level-3').addEventListener('click', () => selectLevel(3));

    const zoomSlider = document.getElementById('zoom-slider');
    zoomSlider.addEventListener('input', (event) => {
        camera.zoom = parseFloat(event.target.value);
        camera.updateProjectionMatrix();
    });
}

function selectLevel(level) {
    currentLevel = level;
    document.getElementById('level-select-container').classList.add('hidden');
    document.getElementById('menu-instruction-text').textContent = 'Ahora, haz clic en un personaje';
}


// Helper para reproducir sonidos
function playSound(sound) {
    // Usar el sistema de audio de Three.js
    if (sound && sound.buffer) {
        if (sound.isPlaying) {
            sound.stop(); // Detiene el sonido si ya se está reproduciendo
        }
        sound.offset = 0; // Asegura que el sonido comience desde el principio
        sound.play();
    }
}

// Nueva función para limpiar y construir el mundo según el nivel
function setupWorldForLevel() {
    // 1. Limpiar completamente el mundo del juego
    while(worldGroup.children.length > 0){ 
        worldGroup.remove(worldGroup.children[0]); 
    }
    vehicles = [];
    lanes = [];

    // 2. Regenerar el mapa y el escenario para el nivel actual
    const mapDepth = currentLevel < 3 ? currentLevel * 10 * CONFIG.laneWidth : ((currentLevel - 2) * 12 * CONFIG.laneWidth) + CONFIG.laneWidth;
    generateMap();
}


// Gestión del Flujo del Juego
function startGame(animal) {
    cancelAnimationFrame(menuAnimationId); // Detener la animación del menú
    inMenu = false;
    currentAnimalType = animal;
    document.getElementById('menu-screen').classList.add('hidden');
    document.getElementById('character-container').classList.add('hidden');
    document.getElementById('zoom-control-container').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('btn-restart-to-menu').classList.remove('hidden');

    if (backgroundMusic && backgroundMusic.buffer && !backgroundMusic.isPlaying) {
        backgroundMusic.play();
    }

    // El worldGroup ya es visible, no hace falta cambiarlo.
    // Los personajes del menú se ocultan al ocultar su contenedor.

    // Limpiar y generar el mundo correcto para el nivel seleccionado
    setupWorldForLevel();

    createPlayer(animal);
    isGameOver = false;
    animate();
}

function fallOff() {
    playSound(fallSound);
    document.getElementById('game-over-screen').querySelector('h2').textContent = "¡TE CAÍSTE!"; // Mensaje específico
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.getElementById('zoom-control-container').classList.add('hidden');
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('btn-restart-to-menu').classList.add('hidden');
    isGameOver = true;
    cancelAnimationFrame(animationId);
}

function gameOver() {
    playSound(collisionSound);
    document.getElementById('game-over-screen').querySelector('h2').textContent = "¡TE CHOCARON!"; // Mensaje específico
    isGameOver = true;
    document.getElementById('zoom-control-container').classList.add('hidden');
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('btn-restart-to-menu').classList.add('hidden');
    document.getElementById('game-over-screen').classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function winGame() {
    isGameOver = true;
    
    // Añadir monedas como recompensa
    playerCoins += 10;
    document.getElementById('coin-text').textContent = playerCoins;

    // Lógica para mostrar solo las recompensas aplicables
    const bocaShirtButton = document.getElementById('btn-skin-boca');
    const riverShirtButton = document.getElementById('btn-skin-river');

    if (currentAnimalType === 'cerdo') {
        bocaShirtButton.style.display = 'inline-block';
        riverShirtButton.style.display = 'none';
    } else if (currentAnimalType === 'gallina') {
        bocaShirtButton.style.display = 'none';
        riverShirtButton.style.display = 'inline-block';
    }
    
    // Actualizar el texto del botón del siguiente nivel
    document.getElementById('btn-next-level').textContent = `Avanzar al Nivel ${currentLevel + 1}`;

    document.getElementById('character-container').classList.add('hidden'); // Ocultar personajes del menú
    document.getElementById('zoom-control-container').classList.add('hidden');
    document.getElementById('controls').classList.add('hidden');
    document.getElementById('btn-restart-to-menu').classList.add('hidden');
    document.getElementById('reward-screen').classList.remove('hidden');
    cancelAnimationFrame(animationId);
}

function goToNextLevel() {
    currentLevel++;
    resetGame(true); // Llama a resetGame indicando que es para el siguiente nivel
}

function applySkin(skinName) {
    equippedSkin = skinName;
    alert('¡Skin ' + skinName.replace('_', ' ') + ' equipada! Dale a "Jugar de nuevo".');
}

function resetGame(isNextLevel = false) {
    // Si no estamos avanzando de nivel, volvemos al menú principal
    if (!isNextLevel) {
        // Esto es un simple F5, pero podríamos hacer una función más elegante
        // que no recargue toda la página. Por ahora, es lo más simple.
        window.location.reload();
        return;
    }
    // 1. Limpiar completamente el mundo del juego
    while(worldGroup.children.length > 0){ 
        worldGroup.remove(worldGroup.children[0]); 
    }
    vehicles = [];
    lanes = [];

    // 2. Regenerar el mapa y el escenario para el nivel actual
    const mapDepth = currentLevel < 3 ? currentLevel * 10 * CONFIG.laneWidth : ((currentLevel - 2) * 12 * CONFIG.laneWidth) + CONFIG.laneWidth;
    generateMap();

    document.getElementById('reward-screen').classList.add('hidden');
    document.getElementById('game-over-screen').querySelector('h2').textContent = "¡JUEGO TERMINADO!"; // Resetea el mensaje
    document.getElementById('game-over-screen').classList.add('hidden');
    
    // Resetear y mostrar el slider de zoom
    document.getElementById('zoom-slider').value = 1; // Resetea el valor
    camera.zoom = 1; // Resetea el zoom de la cámara
    document.getElementById('controls').classList.remove('hidden');
    document.getElementById('zoom-control-container').classList.remove('hidden');

    // 1. Resetear posiciones
    targetPosition = { x: 0, z: 0 };
    player.rotation.set(0, 0, 0); // Resetear rotación de caída
    player.position.set(0, 0, 0);
    camera.position.set(100, 100, 100);

    // 2. Aplicar la skin que el jugador haya elegido
    const body = player.getObjectByName('body');
    const bocaShirt = player.getObjectByName('shirt');
    const riverShirt = player.getObjectByName('river_shirt');

    // Primero, resetear todo al estado visual por defecto
    if (bocaShirt) bocaShirt.visible = false; 
    if (riverShirt) riverShirt.visible = false;

    if (body) { // Resetear color base del cuerpo
        const defaultColors = { 'cerdo': 0xffaec9, 'gallina': 0xEAEAEA };
        if (defaultColors[currentAnimalType]) {
            body.material.color.setHex(defaultColors[currentAnimalType]);
        }
    }

    // Ahora, aplicar la skin equipada
    if (equippedSkin === 'camiseta_futbol' && bocaShirt) {
        bocaShirt.visible = true;
    } else if (equippedSkin === 'camiseta_river' && riverShirt) {
        riverShirt.visible = true;
    } else if (equippedSkin === 'gala' && body) {
        body.material.color.setHex(0x000000);
    }
    
    // 3. Reanudar el juego
    isGameOver = false;
    isFalling = false;
    animate();
}

// Arrancar setup
init();