// Game state
let gameState = {
    paused: false,
    gameOver: false,
    started: false,
    score: 0,
    health: 100,
    maxHealth: 100
};

// Scene setup
let scene, camera, renderer;
let player, enemies = [];
let projectiles = [];
let obstacles = [];
let keys = {};
let mouse = { x: 0, y: 0 };

// Physics
const GRAVITY = 9.81;
const GROUND_SIZE = 1600; // Dobrado para incluir cidade
const GROUND_HEIGHT = 0;
const TERRAIN_SEGMENTS = 128; // Mais segmentos = terreno mais suave
const CITY_SIZE = 600; // Tamanho da área da cidade
const CITY_OFFSET_X = 200; // Offset X da cidade
const CITY_OFFSET_Z = 200; // Offset Z da cidade
const CITY_PLATFORM_HEIGHT = 5; // Altura da plataforma da cidade sobre o terreno
let terrainMesh = null;
let buildings = [];
let cars = [];
let pedestrians = [];

// Initialize Three.js
function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Céu azul claro
    scene.fog = new THREE.Fog(0x87CEEB, 100, 800);
    
    // Camera
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 100, 150);
    camera.lookAt(0, 0, 0);
    
    // Renderer
    const canvas = document.getElementById('game-canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(200, 400, 200);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.left = -GROUND_SIZE / 2;
    directionalLight.shadow.camera.right = GROUND_SIZE / 2;
    directionalLight.shadow.camera.top = GROUND_SIZE / 2;
    directionalLight.shadow.camera.bottom = -GROUND_SIZE / 2;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 1000;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);
    
    // Create terrain with elevations
    createTerrain();
    
    // Create city
    createCity();
    
    // Create player vehicle
    createPlayer();
    
    // Create enemies
    createEnemies(3);
    
    // Event listeners
    setupEventListeners();
    
    // Start game loop
    animate();
}

// Create terrain with elevations
function createTerrain() {
    // Criar geometria do terreno com muitos segmentos para poder modificar vértices
    const groundGeometry = new THREE.PlaneGeometry(
        GROUND_SIZE, 
        GROUND_SIZE, 
        TERRAIN_SEGMENTS, 
        TERRAIN_SEGMENTS
    );
    
    // Modificar vértices para criar elevações
    const positions = groundGeometry.attributes.position;
    const vertices = positions.array;
    
    // Simular elevações usando função seno/cosseno e ruído
    const maxHeight = 30; // Altura máxima das elevações
    
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 1];
        
        // Criar elevações usando múltiplas funções de onda
        let height = 0;
        height += Math.sin(x * 0.01) * 10;
        height += Math.cos(z * 0.01) * 8;
        height += Math.sin(x * 0.02 + z * 0.02) * 5;
        height += Math.cos(x * 0.03 - z * 0.03) * 3;
        height += (Math.random() - 0.5) * 4; // Ruído aleatório
        
        // Limitar altura
        height = Math.max(-maxHeight * 0.3, Math.min(maxHeight, height));
        
        vertices[i + 2] = height; // Y é o eixo vertical em Three.js
    }
    
    // Atualizar normais para iluminação correta
    groundGeometry.computeVertexNormals();
    
    // Material do terreno (terra/marrom)
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x8B4513, // Marrom terra
        roughness: 1.0,
        metalness: 0.0,
        flatShading: false
    });
    
    terrainMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    terrainMesh.rotation.x = -Math.PI / 2;
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    
    // Adicionar grid graficamente sobre o terreno (opcional)
    const gridHelper = new THREE.GridHelper(GROUND_SIZE, 40, 0x6B4423, 0x5A3821);
    scene.add(gridHelper);
}

// Create city with buildings, streets, and urban elements
function createCity() {
    // Criar plataforma plana elevada para a cidade (solo base)
    const platformGeometry = new THREE.BoxGeometry(CITY_SIZE, CITY_PLATFORM_HEIGHT, CITY_SIZE);
    const platformMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x444444, // Cor de concreto/terraplanagem
        roughness: 0.9,
        metalness: 0.1
    });
    const cityPlatform = new THREE.Mesh(platformGeometry, platformMaterial);
    cityPlatform.position.set(
        CITY_OFFSET_X, 
        CITY_PLATFORM_HEIGHT / 2, 
        CITY_OFFSET_Z
    );
    cityPlatform.receiveShadow = true;
    cityPlatform.castShadow = true;
    scene.add(cityPlatform);
    
    // Criar área de asfalto plano sobre a plataforma
    const cityGroundGeometry = new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE, 10, 10);
    const cityGroundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x333333, // Asfalto escuro
        roughness: 0.9,
        metalness: 0.1
    });
    const cityGround = new THREE.Mesh(cityGroundGeometry, cityGroundMaterial);
    cityGround.rotation.x = -Math.PI / 2;
    cityGround.position.set(
        CITY_OFFSET_X, 
        CITY_PLATFORM_HEIGHT + 0.1, // Sobre a plataforma
        CITY_OFFSET_Z
    );
    cityGround.receiveShadow = true;
    scene.add(cityGround);
    
    // Criar ruas e avenidas (linhas brancas/amarelas)
    createStreets();
    
    // Criar edifícios
    createBuildings();
    
    // Criar muros e cercas
    createWalls();
    
    // Criar carros estacionados
    createParkedCars();
    
    // Criar pedestres
    createPedestrians();
}

// Create streets and avenues
function createStreets() {
    const streetMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFF00 }); // Linhas amarelas
    
    // Avenida horizontal principal no meio da cidade
    const mainAvenueX = CITY_OFFSET_X;
    const mainAvenueZ = CITY_OFFSET_Z;
    
    const lineHeight = CITY_PLATFORM_HEIGHT + 0.15; // Altura sobre a plataforma
    
    // Criar avenidas principais (vias bem definidas)
    const avenueWidth = 50; // Largura total da avenida
    
    // Avenida horizontal principal - criar via de asfalto mais escuro
    const avenueAsphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a }); // Asfalto mais escuro para vias
    const avenueHorizontal = new THREE.Mesh(
        new THREE.BoxGeometry(avenueWidth, 0.15, CITY_SIZE),
        avenueAsphaltMaterial
    );
    avenueHorizontal.position.set(mainAvenueX, lineHeight, mainAvenueZ);
    scene.add(avenueHorizontal);
    
    // Linha central amarela da avenida horizontal
    const centerLine1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.2, CITY_SIZE),
        streetMaterial
    );
    centerLine1.position.set(mainAvenueX, lineHeight + 0.08, mainAvenueZ);
    scene.add(centerLine1);
    
    // Avenida vertical principal - criar via de asfalto mais escuro
    const avenueVertical = new THREE.Mesh(
        new THREE.BoxGeometry(CITY_SIZE, 0.15, avenueWidth),
        avenueAsphaltMaterial
    );
    avenueVertical.position.set(mainAvenueX, lineHeight, mainAvenueZ);
    scene.add(avenueVertical);
    
    // Linha central amarela da avenida vertical
    const centerLine2 = new THREE.Mesh(
        new THREE.BoxGeometry(CITY_SIZE, 0.2, 0.5),
        streetMaterial
    );
    centerLine2.position.set(mainAvenueX, lineHeight + 0.08, mainAvenueZ);
    scene.add(centerLine2);
    
    // Ruas secundárias (mais estreitas) - criar vias bem definidas
    const streetWidth = 30; // Largura das ruas secundárias
    const streetLineMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF }); // Linhas brancas
    const streetAsphaltMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    
    for (let i = -CITY_SIZE / 2 + 75; i <= CITY_SIZE / 2 - 75; i += 150) {
        // Evitar sobreposição com avenidas principais
        if (Math.abs(i) < 30) continue;
        
        // Via de asfalto horizontal
        const streetHorizontal = new THREE.Mesh(
            new THREE.BoxGeometry(streetWidth, 0.15, CITY_SIZE),
            streetAsphaltMaterial
        );
        streetHorizontal.position.set(CITY_OFFSET_X + i, lineHeight, CITY_OFFSET_Z);
        scene.add(streetHorizontal);
        
        // Linhas brancas laterais da rua horizontal
        const streetLineH1 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.2, CITY_SIZE),
            streetLineMaterial
        );
        streetLineH1.position.set(CITY_OFFSET_X + i - streetWidth/2 + 1, lineHeight + 0.08, CITY_OFFSET_Z);
        scene.add(streetLineH1);
        
        const streetLineH2 = new THREE.Mesh(
            new THREE.BoxGeometry(0.3, 0.2, CITY_SIZE),
            streetLineMaterial
        );
        streetLineH2.position.set(CITY_OFFSET_X + i + streetWidth/2 - 1, lineHeight + 0.08, CITY_OFFSET_Z);
        scene.add(streetLineH2);
        
        // Via de asfalto vertical
        const streetVertical = new THREE.Mesh(
            new THREE.BoxGeometry(CITY_SIZE, 0.15, streetWidth),
            streetAsphaltMaterial
        );
        streetVertical.position.set(CITY_OFFSET_X, lineHeight, CITY_OFFSET_Z + i);
        scene.add(streetVertical);
        
        // Linhas brancas laterais da rua vertical
        const streetLineV1 = new THREE.Mesh(
            new THREE.BoxGeometry(CITY_SIZE, 0.2, 0.3),
            streetLineMaterial
        );
        streetLineV1.position.set(CITY_OFFSET_X, lineHeight + 0.08, CITY_OFFSET_Z + i - streetWidth/2 + 1);
        scene.add(streetLineV1);
        
        const streetLineV2 = new THREE.Mesh(
            new THREE.BoxGeometry(CITY_SIZE, 0.2, 0.3),
            streetLineMaterial
        );
        streetLineV2.position.set(CITY_OFFSET_X, lineHeight + 0.08, CITY_OFFSET_Z + i + streetWidth/2 - 1);
        scene.add(streetLineV2);
    }
}

// Create buildings
function createBuildings() {
    const buildingSpacing = 120;
    const blockStartX = CITY_OFFSET_X - CITY_SIZE / 2 + 80;
    const blockStartZ = CITY_OFFSET_Z - CITY_SIZE / 2 + 80;
    
    for (let x = blockStartX; x < CITY_OFFSET_X + CITY_SIZE / 2 - 60; x += buildingSpacing) {
        for (let z = blockStartZ; z < CITY_OFFSET_Z + CITY_SIZE / 2 - 60; z += buildingSpacing) {
            // Evitar colocar edifícios nas avenidas principais
            if (Math.abs(x - CITY_OFFSET_X) < 30 || Math.abs(z - CITY_OFFSET_Z) < 30) {
                continue;
            }
            
            // Altura variável dos edifícios
            const height = 15 + Math.random() * 40; // 15 a 55 unidades
            const width = 20 + Math.random() * 15; // 20 a 35 unidades
            const depth = 20 + Math.random() * 15;
            
            // Material do edifício
            const buildingMaterial = new THREE.MeshStandardMaterial({ 
                color: new THREE.Color().setHSL(0.1, 0.2, 0.4 + Math.random() * 0.3),
                roughness: 0.8,
                metalness: 0.1
            });
            
            const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            // Posicionar edifício sobre a plataforma da cidade
            building.position.set(x, CITY_PLATFORM_HEIGHT + height / 2 + 0.1, z);
            building.castShadow = true;
            building.receiveShadow = true;
            scene.add(building);
            
            // Adicionar janelas
            const windowMaterial = new THREE.MeshStandardMaterial({ 
                color: 0x222244,
                emissive: Math.random() > 0.7 ? 0x4444AA : 0x000000,
                emissiveIntensity: 0.3
            });
            
            for (let floor = 1; floor < height / 8; floor++) {
                for (let side = 0; side < 2; side++) {
                    const window = new THREE.Mesh(
                        new THREE.PlaneGeometry(3, 4),
                        windowMaterial
                    );
                    window.position.copy(building.position);
                    window.position.y = floor * 8 - 2;
                    if (side === 0) {
                        window.position.x += width / 2 + 0.1;
                        window.rotation.y = Math.PI / 2;
                    } else {
                        window.position.x -= width / 2 + 0.1;
                        window.rotation.y = -Math.PI / 2;
                    }
                    scene.add(window);
                }
            }
            
            // Adicionar ao array de edifícios para colisão
            buildings.push({
                mesh: building,
                position: building.position,
                size: { width, height, depth },
                box: new THREE.Box3().setFromObject(building)
            });
        }
    }
}

// Create walls and fences
function createWalls() {
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    const wallHeight = 4;
    const wallThickness = 0.5;
    
    // Muros ao redor de alguns blocos da cidade
    const wallPositions = [
        { x: CITY_OFFSET_X - 150, z: CITY_OFFSET_Z + 100, length: 100, rotation: 0 },
        { x: CITY_OFFSET_X + 150, z: CITY_OFFSET_Z - 100, length: 80, rotation: Math.PI / 2 },
        { x: CITY_OFFSET_X - 100, z: CITY_OFFSET_Z - 150, length: 120, rotation: 0 }
    ];
    
    wallPositions.forEach(wall => {
        const wallMesh = new THREE.Mesh(
            new THREE.BoxGeometry(wall.length, wallHeight, wallThickness),
            wallMaterial
        );
        // Posicionar muro sobre a plataforma da cidade
        wallMesh.position.set(wall.x, CITY_PLATFORM_HEIGHT + wallHeight / 2 + 0.1, wall.z);
        wallMesh.rotation.y = wall.rotation;
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        scene.add(wallMesh);
        
        buildings.push({
            mesh: wallMesh,
            position: wallMesh.position,
            size: { width: wall.length, height: wallHeight, depth: wallThickness },
            box: new THREE.Box3().setFromObject(wallMesh)
        });
    });
}

// Create parked cars
function createParkedCars() {
    const carCount = 15;
    
    for (let i = 0; i < carCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * (CITY_SIZE / 3);
        const x = CITY_OFFSET_X + Math.cos(angle) * distance;
        const z = CITY_OFFSET_Z + Math.sin(angle) * distance;
        
        // Verificar se está longe das avenidas principais
        if (Math.abs(x - CITY_OFFSET_X) < 40 || Math.abs(z - CITY_OFFSET_Z) < 40) {
            continue;
        }
        
        const carGroup = new THREE.Group();
        
        // Corpo do carro (menor que os veículos jogáveis)
        const carBodyGeometry = new THREE.BoxGeometry(3, 1.5, 5);
        const carBodyMaterial = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
        });
        const carBody = new THREE.Mesh(carBodyGeometry, carBodyMaterial);
        carBody.position.y = 0.75;
        carBody.castShadow = true;
        carGroup.add(carBody);
        
        // Rodas
        const wheelGeometry = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            { x: 1, y: 0.4, z: 1.5 },
            { x: -1, y: 0.4, z: 1.5 },
            { x: 1, y: 0.4, z: -1.5 },
            { x: -1, y: 0.4, z: -1.5 }
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            carGroup.add(wheel);
        });
        
        // Posicionar carro sobre o asfalto da cidade
        carGroup.position.set(x, CITY_PLATFORM_HEIGHT + 0.1, z);
        carGroup.rotation.y = Math.random() * Math.PI * 2;
        scene.add(carGroup);
        
        cars.push({
            mesh: carGroup,
            position: carGroup.position
        });
    }
}

// Create pedestrians
function createPedestrians() {
    const pedestrianCount = 10;
    // Usar CylinderGeometry para simular corpo humano
    const pedestrianBodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
    const pedestrianHeadGeometry = new THREE.SphereGeometry(0.3, 8, 8);
    
    for (let i = 0; i < pedestrianCount; i++) {
        const pedestrianMaterial = new THREE.MeshStandardMaterial({ 
            color: new THREE.Color().setHSL(Math.random(), 0.5, 0.5 + Math.random() * 0.3)
        });
        const angle = Math.random() * Math.PI * 2;
        const distance = CITY_SIZE / 4 + Math.random() * (CITY_SIZE / 4);
        const x = CITY_OFFSET_X + Math.cos(angle) * distance;
        const z = CITY_OFFSET_Z + Math.sin(angle) * distance;
        
        // Verificar se está longe das avenidas principais
        if (Math.abs(x - CITY_OFFSET_X) < 40 || Math.abs(z - CITY_OFFSET_Z) < 40) {
            continue;
        }
        
        const pedestrianGroup = new THREE.Group();
        
        // Corpo
        const body = new THREE.Mesh(pedestrianBodyGeometry, pedestrianMaterial);
        body.position.y = 0.6;
        body.castShadow = true;
        pedestrianGroup.add(body);
        
        // Cabeça
        const head = new THREE.Mesh(pedestrianHeadGeometry, pedestrianMaterial);
        head.position.y = 1.5;
        head.castShadow = true;
        pedestrianGroup.add(head);
        
        // Posicionar pedestre sobre o asfalto da cidade
        pedestrianGroup.position.set(x, CITY_PLATFORM_HEIGHT + 0.1, z);
        pedestrianGroup.castShadow = true;
        scene.add(pedestrianGroup);
        
        pedestrians.push({
            mesh: pedestrianGroup,
            position: pedestrianGroup.position,
            speed: 0.02 + Math.random() * 0.03,
            direction: Math.random() * Math.PI * 2
        });
    }
}

// Update pedestrians movement
function updatePedestrians(deltaTime) {
    pedestrians.forEach(pedestrian => {
        // Movimento simples dos pedestres
        pedestrian.mesh.position.x += Math.cos(pedestrian.direction) * pedestrian.speed;
        pedestrian.mesh.position.z += Math.sin(pedestrian.direction) * pedestrian.speed;
        
        // Mudar propriodireção ocasionalmente
        if (Math.random() < 0.01) {
            pedestrian.direction += (Math.random() - 0.5) * 0.5;
        }
        
        // Manter pedestres dentro da área da cidade
        const maxDist = CITY_SIZE / 2 - 20;
        const distX = pedestrian.mesh.position.x - CITY_OFFSET_X;
        const distZ = pedestrian.mesh.position.z - CITY_OFFSET_Z;
        
        if (Math.abs(distX) > maxDist || Math.abs(distZ) > maxDist) {
            pedestrian.direction = Math.atan2(-distZ, -distX);
        }
        
        // Atualizar altura para ficar acima do asfalto
        const terrainHeight = getTerrainHeight(pedestrian.mesh.position.x, pedestrian.mesh.position.z);
        pedestrian.mesh.position.y = terrainHeight + 1.25;
    });
}

// Get terrain height at a given x, z position
function getTerrainHeight(x, z) {
    // Se estiver na área da cidade, retornar altura plana da plataforma
    const cityMinX = CITY_OFFSET_X - CITY_SIZE / 2;
    const cityMaxX = CITY_OFFSET_X + CITY_SIZE / 2;
    const cityMinZ = CITY_OFFSET_Z - CITY_SIZE / 2;
    const cityMaxZ = CITY_OFFSET_Z + CITY_SIZE / 2;
    
    if (x >= cityMinX && x <= cityMaxX && z >= cityMinZ && z <= cityMaxZ) {
        return 5.1; // Altura da plataforma + asfalto (plano)
    }
    
    if (!terrainMesh) return 0;
    
    // Normalizar coordenadas do mundo para UV (0 a 1) - o terreno vai de -GROUND_SIZE/2 a +GROUND_SIZE/2
    const halfSize = GROUND_SIZE / 2;
    const u = (x + halfSize) / GROUND_SIZE;
    const v = (z + halfSize) / GROUND_SIZE;
    
    // Clamp entre 0 e 1
    const clampedU = Math.max(0, Math.min(1, u));
    const clampedV = Math.max(0, Math.min(1, v));
    
    // Obter índices de vértices
    const segments = TERRAIN_SEGMENTS;
    const indexX = Math.floor(clampedU * segments);
    const indexZ = Math.floor(clampedV * segments);
    
    // Interpolação bilinear para suavizar
    const fx = (clampedU * segments) - indexX;
    const fz = (clampedV * segments) - indexZ;
    
    const positions = terrainMesh.geometry.attributes.position;
    const vertices = positions.array;
    
    // Obter alturas dos 4 vértices ao redor
    const getHeight = (ix, iz) => {
        const idx = (iz * (segments + 1) + ix) * 3;
        if (idx >= 0 && idx < vertices.length) {
            return vertices[idx + 2];
        }
        return 0;
    };
    
    const h00 = getHeight(indexX, indexZ);
    const h10 = getHeight(indexX + 1, indexZ);
    const h01 = getHeight(indexX, indexZ + 1);
    const h11 = getHeight(indexX + 1, indexZ + 1);
    
    // Interpolação bilinear
    const h0 = h00 * (1 - fx) + h10 * fx;
    const h1 = h01 * (1 - fx) + h11 * fx;
    return h0 * (1 - fz) + h1 * fz;
}

// Create arena boundaries (removido - terreno aberto)
function createArena() {
    // Walls removed - open terrain
    return;
    
    const wallHeight = 10;
    const wallThickness = 2;
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
    
    // North wall
    const northWall = new THREE.Mesh(
        new THREE.BoxGeometry(GROUND_SIZE, wallHeight, wallThickness),
        wallMaterial
    );
    northWall.position.set(0, wallHeight / 2, GROUND_SIZE / 2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    scene.add(northWall);
    
    // South wall
    const southWall = new THREE.Mesh(
        new THREE.BoxGeometry(GROUND_SIZE, wallHeight, wallThickness),
        wallMaterial
    );
    southWall.position.set(0, wallHeight / 2, -GROUND_SIZE / 2);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    scene.add(southWall);
    
    // East wall
    const eastWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, GROUND_SIZE),
        wallMaterial
    );
    eastWall.position.set(GROUND_SIZE / 2, wallHeight / 2, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    scene.add(eastWall);
    
    // West wall
    const westWall = new THREE.Mesh(
        new THREE.BoxGeometry(wallThickness, wallHeight, GROUND_SIZE),
        wallMaterial
    );
    westWall.position.set(-GROUND_SIZE / 2, wallHeight / 2, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    scene.add(westWall);
}

// Create obstacles
function createObstacles() {
    const obstacleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
    
    const obstaclePositions = [
        { x: 30, y: 0, z: 30 },
        { x: -30, y: 0, z: 30 },
        { x: 30, y: 0, z: -30 },
        { x: -30, y: 0, z: -30 },
        { x: 0, y: 0, z: 40 },
        { x: 40, y: 0, z: 0 },
        { x: -40, y: 0, z: 0 },
        { x: 0, y: 0, z: -40 }
    ];
    
    obstaclePositions.forEach(pos => {
        const size = 5 + Math.random() * 5;
        const obstacle = new THREE.Mesh(
            new THREE.BoxGeometry(size, size * 2, size),
            obstacleMaterial
        );
        obstacle.position.set(pos.x, pos.y + size, pos.z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        const box = new THREE.Box3().setFromObject(obstacle);
        obstacles.push({
            mesh: obstacle,
            box: box,
            position: obstacle.position
        });
        
        scene.add(obstacle);
    });
}

// Create player vehicle
function createPlayer() {
    const group = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.BoxGeometry(4, 2.5, 6);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1.5; // Ajustado para acomodar rodas maiores
    body.castShadow = true;
    group.add(body);
    
    // Wheels (maiores para melhor física com terreno)
    const wheelRadius = 2; // Aumentado de 1 para 2
    const wheelWidth = 1.2; // Aumentado de 0.5 para 1.2
    const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
    const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
    
    const wheelPositions = [
        { x: 1.8, y: -0.3, z: 2.2 },
        { x: -1.8, y: -0.3, z: 2.2 },
        { x: 1.8, y: -0.3, z: -2.2 },
        { x: -1.8, y: -0.3, z: -2.2 }
    ];
    
    wheelPositions.forEach(pos => {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(pos.x, pos.y, pos.z);
        wheel.castShadow = true;
        group.add(wheel);
    });
    
    // Gun turret
    const turretGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
    const turretMaterial = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
    const turret = new THREE.Mesh(turretGeometry, turretMaterial);
    turret.position.y = 2.5;
    turret.castShadow = true;
    group.add(turret);
    
    // Posicionar jogador na altura do terreno (rodas maiores = mais altura)
    const startHeight = getTerrainHeight(0, 0);
    group.position.set(0, startHeight + 2.2, 0); // Aumentado para rodas maiores tocarem o chão
    scene.add(group);
    
    player = {
        mesh: group,
        velocity: new THREE.Vector3(0, 0, 0),
        speed: 0,
        maxSpeed: 0.5,
        acceleration: 0.02,
        rotation: 0,
        health: 100,
        maxHealth: 100,
        canShoot: true,
        shootCooldown: 0,
        // Física
        mass: 1500, // kg - peso do veículo
        angularVelocity: 0, // velocidade angular para tombamento
        roll: 0, // rotação X (tombamento lateral)
        pitch: 0, // rotação Z (tombamento frontal)
        isDestroyed: false,
        destructionTimer: 0
    };
}

// Create enemies
function createEnemies(count) {
    for (let i = 0; i < count; i++) {
        const group = new THREE.Group();
        
        // Random position
        const angle = (Math.PI * 2 * i) / count;
        const radius = 60;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(4, 2.5, 6);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.5; // Ajustado para acomodar rodas maiores
        body.castShadow = true;
        group.add(body);
        
        // Wheels (maiores para melhor física com terreno)
        const wheelRadius = 2; // Aumentado de 1 para 2
        const wheelWidth = 1.2; // Aumentado de 0.5 para 1.2
        const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111111 });
        
        const wheelPositions = [
            { x: 1.8, y: -0.3, z: 2.2 },
            { x: -1.8, y: -0.3, z: 2.2 },
            { x: 1.8, y: -0.3, z: -2.2 },
            { x: -1.8, y: -0.3, z: -2.2 }
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, pos.y, pos.z);
            wheel.castShadow = true;
            group.add(wheel);
        });
        
        // Gun turret
        const turretGeometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const turretMaterial = new THREE.MeshStandardMaterial({ color: 0xaa0000 });
        const turret = new THREE.Mesh(turretGeometry, turretMaterial);
        turret.position.y = 2.5;
        turret.castShadow = true;
        group.add(turret);
        
        // Posicionar inimigo na altura do terreno (rodas maiores = mais altura)
        const enemyHeight = getTerrainHeight(x, z);
        group.position.set(x, enemyHeight + 2.2, z); // Aumentado para rodas maiores tocarem o chão
        scene.add(group);
        
        enemies.push({
            mesh: group,
            velocity: new THREE.Vector3(0, 0, 0),
            speed: 0,
            maxSpeed: 0.3 + Math.random() * 0.2,
            rotation: angle + Math.PI,
            health: 100,
            maxHealth: 100,
            canShoot: true,
            shootCooldown: 0,
            aiState: 'patrol', // patrol, chase, attack
            aiTimer: 0,
            // Física
            mass: 1200 + Math.random() * 600, // kg - peso variável entre 1200-1800kg
            angularVelocity: 0,
            roll: 0,
            pitch: 0,
            isDestroyed: false,
            destructionTimer: 0
        });
    }
}

// Create projectile
function createProjectile(position, direction, owner) {
    const geometry = new THREE.SphereGeometry(0.3, 8, 8);
    const material = new THREE.MeshStandardMaterial({ 
        color: owner === 'player' ? 0x00ff00 : 0xff0000,
        emissive: owner === 'player' ? 0x00ff00 : 0xff0000,
        emissiveIntensity: 0.5
    });
    const sphere = new THREE.Mesh(geometry, material);
    
    // Garantir que o projétil sempre seja criado acima do terreno
    const terrainHeight = getTerrainHeight(position.x, position.z);
    sphere.position.copy(position);
    // Se a posição estiver muito baixa, garantir altura mínima
    if (sphere.position.y < terrainHeight + 1) {
        sphere.position.y = terrainHeight + 2;
    } else {
        // Manter altura relativa se já está suficientemente alto
        sphere.position.y = Math.max(sphere.position.y, terrainHeight + 1);
    }
    
    sphere.castShadow = true;
    scene.add(sphere);
    
    projectiles.push({
        mesh: sphere,
        velocity: direction.clone().normalize().multiplyScalar(2.0), // Velocidade maior e direção fixa
        direction: direction.clone().normalize(), // Direção inicial fixa em linha reta
        owner: owner,
        lifetime: 3000 // 3 seconds
    });
}

// Player shooting
function shootPlayer() {
    // Permitir múltiplos tiros - cooldown curto
    if (player.shootCooldown > 0) return;
    
    // Direção do tiro baseada na frente do veículo
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(player.mesh.quaternion);
    
    // Posição inicial do projétil (na frente do veículo)
    // Usar offset relativo ao veículo considerando altura do terreno
    const spawnOffset = new THREE.Vector3(0, 0, -4); // Posição na frente, altura será ajustada
    spawnOffset.applyQuaternion(player.mesh.quaternion);
    const spawnPos = player.mesh.position.clone().add(spawnOffset);
    // Garantir que o spawn está sempre acima do terreno
    const terrainHeight = getTerrainHeight(spawnPos.x, spawnPos.z);
    spawnPos.y = Math.max(spawnPos.y, terrainHeight + 3); // Altura mínima acima do terreno
    
    createProjectile(spawnPos, direction, 'player');
    
    // Cooldown curto para permitir múltiplos tiros
    player.shootCooldown = 10;
}

// Enemy shooting
function shootEnemy(enemy) {
    if (enemy.shootCooldown > 0 || enemy.isDestroyed) return;
    
    const direction = new THREE.Vector3().subVectors(
        player.mesh.position,
        enemy.mesh.position
    ).normalize();
    
    // Posição inicial do projétil (na frente do veículo)
    // Usar offset relativo ao veículo considerando altura do terreno
    const spawnOffset = new THREE.Vector3(0, 0, -4); // Posição na frente, altura será ajustada
    spawnOffset.applyQuaternion(enemy.mesh.quaternion);
    const spawnPos = enemy.mesh.position.clone().add(spawnOffset);
    // Garantir que o spawn está sempre acima do terreno
    const terrainHeight = getTerrainHeight(spawnPos.x, spawnPos.z);
    spawnPos.y = Math.max(spawnPos.y, terrainHeight + 3); // Altura mínima acima do terreno
    
    createProjectile(spawnPos, direction, 'enemy');
    
    enemy.shootCooldown = 40 + Math.random() * 40;
}

// Update player movement
function updatePlayer(deltaTime) {
    if (gameState.paused || gameState.gameOver) return;
    
    // Input handling
    let moveForward = keys['w'] || keys['W'];
    let moveBackward = keys['s'] || keys['S'];
    let turnLeft = keys['a'] || keys['A'];
    let turnRight = keys['d'] || keys['D'];
    
    // Rotation
    if (turnLeft) {
        player.rotation += 0.03;
    }
    if (turnRight) {
        player.rotation -= 0.03;
    }
    player.mesh.rotation.y = player.rotation;
    
    // Movement
    if (moveForward) {
        player.speed = Math.min(player.speed + player.acceleration, player.maxSpeed);
    } else if (moveBackward) {
        player.speed = Math.max(player.speed - player.acceleration, -player.maxSpeed * 0.7);
    } else {
        player.speed *= 0.95; // Friction
    }
    
    // Apply movement
    const direction = new THREE.Vector3(0, 0, -player.speed);
    direction.applyQuaternion(player.mesh.quaternion);
    player.mesh.position.add(direction);
    
    // Follow terrain height (ajustado para rodas maiores)
    const terrainHeight = getTerrainHeight(player.mesh.position.x, player.mesh.position.z);
    player.mesh.position.y = terrainHeight + 2.2; // Altura base do veículo sobre o terreno
    
    // Aplicar física de tombamento baseada no terreno
    if (!player.isDestroyed) {
        applyVehiclePhysics(player);
    }
    
    // Boundary collision
    const halfSize = GROUND_SIZE / 2 - 5;
    player.mesh.position.x = Math.max(-halfSize, Math.min(halfSize, player.mesh.position.x));
    player.mesh.position.z = Math.max(-halfSize, Math.min(halfSize, player.mesh.position.z));
    
    // Shooting
    if (keys[' '] || keys['Space']) {
        shootPlayer();
    }
    
    // Update cooldown
    if (player.shootCooldown > 0) {
        player.shootCooldown--;
    }
    
    // Update camera to follow player
    const cameraOffset = new THREE.Vector3(0, 80, 120);
    cameraOffset.applyQuaternion(player.mesh.quaternion);
    const targetCameraPos = player.mesh.position.clone().add(cameraOffset);
    camera.position.lerp(targetCameraPos, 0.1);
    camera.lookAt(player.mesh.position);
    
    // Update HUD speed
    const speedKmh = Math.abs(player.speed * 200);
    document.getElementById('speed-text').textContent = Math.round(speedKmh) + ' km/h';
}

// Update enemies (AI)
function updateEnemies(deltaTime) {
    enemies.forEach(enemy => {
        if (enemy.health <= 0 || enemy.isDestroyed) return;
        
        enemy.aiTimer += deltaTime;
        
        // Calculate distance to player
        const distanceToPlayer = enemy.mesh.position.distanceTo(player.mesh.position);
        
        // AI behavior
        if (distanceToPlayer < 30) {
            enemy.aiState = 'chase';
            
            // Point towards player
            const direction = new THREE.Vector3().subVectors(
                player.mesh.position,
                enemy.mesh.position
            );
            enemy.rotation = Math.atan2(direction.x, direction.z) + Math.PI;
            enemy.mesh.rotation.y = enemy.rotation;
            
            // Move towards player
            enemy.speed = Math.min(enemy.speed + 0.01, enemy.maxSpeed);
            
            // Shoot if close enough
            if (distanceToPlayer < 40 && Math.random() < 0.02) {
                shootEnemy(enemy);
            }
        } else {
            enemy.aiState = 'patrol';
            
            // Patrol behavior
            if (Math.random() < 0.01) {
                enemy.rotation += (Math.random() - 0.5) * 0.1;
            }
            enemy.speed = enemy.maxSpeed * 0.5;
        }
        
        // Apply movement
        const direction = new THREE.Vector3(0, 0, enemy.speed);
        direction.applyQuaternion(enemy.mesh.quaternion);
        enemy.mesh.position.add(direction);
        
        // Follow terrain height (ajustado para rodas maiores)
        const terrainHeight = getTerrainHeight(enemy.mesh.position.x, enemy.mesh.position.z);
        enemy.mesh.position.y = terrainHeight + 2.2; // Altura base do veículo sobre o terreno
        
        // Aplicar física de tombamento baseada no terreno
        if (!enemy.isDestroyed) {
            applyVehiclePhysics(enemy);
        }
        
        // Boundary collision
        const halfSize = GROUND_SIZE / 2 - 5;
        enemy.mesh.position.x = Math.max(-halfSize, Math.min(halfSize, enemy.mesh.position.x));
        enemy.mesh.position.z = Math.max(-halfSize, Math.min(halfSize, enemy.mesh.position.z));
        
        // Update cooldown
        if (enemy.shootCooldown > 0) {
            enemy.shootCooldown--;
        }
    });
}

// Get terrain normal for tilting vehicles
function getTerrainNormal(x, z) {
    if (!terrainMesh) return new THREE.Vector3(0, 1, 0);
    
    const halfSize = GROUND_SIZE / 2;
    const offset = 0.5; // Offset para calcular inclinação
    
    const h1 = getTerrainHeight(x - offset, z);
    const h2 = getTerrainHeight(x + offset, z);
    const h3 = getTerrainHeight(x, z - offset);
    const h4 = getTerrainHeight(x, z + offset);
    
    // Calcular vetores tangentes
    const dx = new THREE.Vector3(offset * 2, h2 - h1, 0);
    const dz = new THREE.Vector3(0, h4 - h3, offset * 2);
    
    // Normal = cross product dos tangentes
    const normal = new THREE.Vector3().crossVectors(dx, dz).normalize();
    return normal;
}

// Apply vehicle physics (tilting, rolling based on terrain)
function applyVehiclePhysics(vehicle) {
    if (vehicle.isDestroyed) return;
    
    // Calcular inclinação do terreno
    const terrainNormal = getTerrainNormal(vehicle.mesh.position.x, vehicle.mesh.position.z);
    
    // Calcular roll (inclinação lateral) baseado no terreno - muito mais suave
    // Usar interpolação suave (lerp) para evitar mudanças bruscas
    const targetRoll = Math.atan2(terrainNormal.x, terrainNormal.y) * 0.08; // Reduzido de 0.3 para 0.08
    vehicle.roll = vehicle.roll * 0.85 + targetRoll * 0.15; // Interpolação suave
    
    // Calcular pitch (inclinação frontal) baseado no terreno - muito mais suave
    const targetPitch = -Math.atan2(terrainNormal.z, terrainNormal.y) * 0.08; // Reduzido de 0.3 para 0.08
    vehicle.pitch = vehicle.pitch * 0.85 + targetPitch * 0.15; // Interpolação suave
    
    // Limitar ângulos máximos para evitar tombamento excessivo
    const maxAngle = 0.2; // ~11 graus
    vehicle.roll = Math.max(-maxAngle, Math.min(maxAngle, vehicle.roll));
    vehicle.pitch = Math.max(-maxAngle, Math.min(maxAngle, vehicle.pitch));
    
    // Aplicar rotações ao veículo
    vehicle.mesh.rotation.x = vehicle.roll;
    vehicle.mesh.rotation.z = vehicle.pitch;
}

// Check vehicle collisions with physics
function checkVehicleCollisions() {
    // Colisão player vs enemies
    enemies.forEach(enemy => {
        if (enemy.isDestroyed || player.isDestroyed) return;
        
        const distance = player.mesh.position.distanceTo(enemy.mesh.position);
        const collisionDistance = 4; // Distância de colisão
        
        if (distance < collisionDistance) {
            // Calcular força de impacto baseada na velocidade e massa
            const relativeVelocity = player.speed - enemy.speed;
            const impactForce = (player.mass * relativeVelocity * relativeVelocity) / 1000;
            
            // Aplicar dano baseado no impacto
            const damage = Math.min(impactForce * 0.1, 30);
            player.health -= damage;
            enemy.health -= damage;
            
            // Aplicar força de repulsão
            const pushDirection = new THREE.Vector3().subVectors(
                player.mesh.position,
                enemy.mesh.position
            ).normalize();
            
            const pushForce = (impactForce / 100) * 0.016; // Aproximação de deltaTime
            player.mesh.position.add(pushDirection.clone().multiplyScalar(pushForce));
            enemy.mesh.position.add(pushDirection.clone().multiplyScalar(-pushForce));
            
            // Verificar destruição
            if (player.health <= 0) {
                destroyVehicle(player);
            }
            if (enemy.health <= 0) {
                destroyVehicle(enemy);
            }
            
            gameState.health = player.health;
            updateHealthBar();
        }
    });
}

// Destroy vehicle
function destroyVehicle(vehicle) {
    if (vehicle.isDestroyed) return;
    
    vehicle.isDestroyed = true;
    vehicle.health = 0;
    
    // Aplicar rotação de tombamento
    vehicle.angularVelocity = (Math.random() - 0.5) * 0.3;
    
    // Alterar cor para indicar destruição
    vehicle.mesh.traverse((child) => {
        if (child.isMesh) {
            child.material = new THREE.MeshStandardMaterial({
                color: 0x333333,
                emissive: 0x660000,
                emissiveIntensity: 0.5
            });
        }
    });
    
    if (vehicle === player) {
        gameOver();
    }
}

// Check obstacle collision
function checkObstacleCollision(position, radius) {
    obstacles.forEach(obstacle => {
        const distance = position.distanceTo(obstacle.position);
        if (distance < radius + 3) {
            const direction = new THREE.Vector3().subVectors(position, obstacle.position).normalize();
            position.add(direction.multiplyScalar((radius + 3) - distance));
        }
    });
    
    // Check collision with buildings
    buildings.forEach(building => {
        const distance = position.distanceTo(building.position);
        const maxDistance = Math.max(building.size.width, building.size.depth) / 2 + radius;
        
        if (distance < maxDistance) {
            const direction = new THREE.Vector3().subVectors(position, building.position).normalize();
            position.add(direction.multiplyScalar(maxDistance - distance));
        }
    });
}

// Update projectiles
function updateProjectiles(deltaTime) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const projectile = projectiles[i];
        
        // Move projectile em linha reta (direção fixa)
        if (projectile.direction) {
            // Usar direção fixa ao invés de velocity para garantir linha reta
            const moveDistance = 2.0 * (deltaTime / 16.67);
            projectile.mesh.position.add(projectile.direction.clone().multiplyScalar(moveDistance));
        } else {
            // Fallback para método antigo se direction não existir
            projectile.mesh.position.add(projectile.velocity);
        }
        
        // Check lifetime
        projectile.lifetime -= deltaTime * 16.67;
        if (projectile.lifetime <= 0) {
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check boundary collision
        const halfSize = GROUND_SIZE / 2;
        if (Math.abs(projectile.mesh.position.x) > halfSize ||
            Math.abs(projectile.mesh.position.z) > halfSize) {
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check ground collision - usar altura do terreno ao invés de valor fixo
        const terrainHeightAtProjectile = getTerrainHeight(
            projectile.mesh.position.x, 
            projectile.mesh.position.z
        );
        if (projectile.mesh.position.y < terrainHeightAtProjectile + 0.5) {
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check obstacle collision
        let hitObstacle = false;
        obstacles.forEach(obstacle => {
            const distance = projectile.mesh.position.distanceTo(obstacle.position);
            if (distance < 3) {
                hitObstacle = true;
            }
        });
        
        // Check building collision
        buildings.forEach(building => {
            const distance = projectile.mesh.position.distanceTo(building.position);
            const maxDistance = Math.max(building.size.width, building.size.depth) / 2;
            if (distance < maxDistance && projectile.mesh.position.y < building.position.y + building.size.height) {
                hitObstacle = true;
            }
        });
        
        if (hitObstacle) {
            scene.remove(projectile.mesh);
            projectiles.splice(i, 1);
            continue;
        }
        
        // Check player collision
        if (projectile.owner === 'enemy') {
            const distance = projectile.mesh.position.distanceTo(player.mesh.position);
            if (distance < 2.5) {
                player.health -= 10;
                gameState.health = player.health;
                updateHealthBar();
                scene.remove(projectile.mesh);
                projectiles.splice(i, 1);
                
                if (player.health <= 0) {
                    gameOver();
                }
                continue;
            }
        }
        
        // Check enemy collision
        if (projectile.owner === 'player') {
            let hitEnemy = false;
            for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
                const enemy = enemies[enemyIndex];
                if (enemy.health <= 0) continue;
                const distance = projectile.mesh.position.distanceTo(enemy.mesh.position);
                if (distance < 2.5) {
                    enemy.health -= 20;
                    hitEnemy = true;
                    
                    if (enemy.health <= 0) {
                        // Enemy destroyed
                        scene.remove(enemy.mesh);
                        enemies.splice(enemyIndex, 1);
                        gameState.score += 100;
                        updateScore();
                        
                        // Check win condition
                        if (enemies.length === 0) {
                            // Victory! Create more enemies
                            createEnemies(3);
                            gameState.score += 500;
                            updateScore();
                        }
                    }
                    break;
                }
            }
            if (hitEnemy) {
                scene.remove(projectile.mesh);
                projectiles.splice(i, 1);
                continue;
            }
        }
    }
}

// Update health bar
function updateHealthBar() {
    const percentage = Math.max(0, (gameState.health / gameState.maxHealth) * 100);
    document.getElementById('health-bar-fill').style.width = percentage + '%';
    document.getElementById('health-text').textContent = Math.round(percentage) + '%';
}

// Update score
function updateScore() {
    document.getElementById('score-text').textContent = gameState.score;
}

// Game over
function gameOver() {
    gameState.gameOver = true;
    document.getElementById('final-score').textContent = 'Pontuação Final: ' + gameState.score;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// Setup event listeners
function setupEventListeners() {
    // Keyboard
    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        
        if (e.key === 'Escape') {
            if (gameState.gameOver) return;
            gameState.paused = !gameState.paused;
            if (gameState.paused) {
                document.getElementById('pause-screen').classList.remove('hidden');
            } else {
                document.getElementById('pause-screen').classList.add('hidden');
            }
        }
    });
    
    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });
    
    // Mouse movement for camera
    window.addEventListener('mousemove', (e) => {
        if (gameState.paused || !gameState.started) return;
        mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });
    
    // Start button
    document.getElementById('start-btn').addEventListener('click', () => {
        document.getElementById('instructions').classList.add('hidden');
        gameState.started = true;
    });
    
    // Resume button
    document.getElementById('resume-btn').addEventListener('click', () => {
        document.getElementById('pause-screen').classList.add('hidden');
        gameState.paused = false;
    });
    
    // Restart button
    document.getElementById('restart-btn').addEventListener('click', () => {
        location.reload();
    });
    
    // Window resize
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    
    if (!gameState.started || gameState.paused) {
        renderer.render(scene, camera);
        return;
    }
    
    const deltaTime = 16.67; // ~60fps
    
    // Update game objects
    updatePlayer(deltaTime);
    updateEnemies(deltaTime);
    checkVehicleCollisions(); // Colisões entre veículos com física
    updateProjectiles(deltaTime);
    updatePedestrians(deltaTime); // Atualizar movimento dos pedestres
    
    // Render
    renderer.render(scene, camera);
}

// Initialize game when page loads
window.addEventListener('load', init);

