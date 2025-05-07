"use client"
import { useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

const ProjectVisualizer = () => {
  const containerRef = useRef(null);
  const textareaRef = useRef(null);
  const [projectData, setProjectData] = useState(null);
  const [visualizationMode, setVisualizationMode] = useState('dependencies');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [animating, setAnimating] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.005);
  const [hoveredElement, setHoveredElement] = useState(null);
  const [highlightedPath, setHighlightedPath] = useState(null);
  const [inputValue, setInputValue] = useState('');
  
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const pointsRef = useRef([]);
  const linesRef = useRef([]);
  const clockRef = useRef(new THREE.Clock());
  const mouseRef = useRef(new THREE.Vector2());
  const raycasterRef = useRef(new THREE.Raycaster());
  const groupRef = useRef(null);
  
  const handleVisualize = () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = JSON.parse(inputValue);
      
      if (sceneRef.current) {
        pointsRef.current.forEach(point => sceneRef.current.remove(point));
        linesRef.current.forEach(line => sceneRef.current.remove(line));
        pointsRef.current = [];
        linesRef.current = [];
        
        if (groupRef.current) {
          sceneRef.current.remove(groupRef.current);
          groupRef.current = null;
        }
      }
      
      setProjectData(data);
      setLoading(false);
    } catch (err) {
      setError("Invalid JSON data: " + err.message);
      setLoading(false);
    }
  };
  
  const simplifyPath = (path) => {
    const parts = path.split('/');
    return parts[parts.length - 1];
  };

  useEffect(() => {
    if (!projectData || !containerRef.current) return;
    
    if (!sceneRef.current) {
      initThreeJs();
    }
    
    createVisualization();
    
    const handleMouseMove = (event) => {
      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / containerRef.current.clientWidth) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / containerRef.current.clientHeight) * 2 + 1;
    };
    
    const handleClick = () => {
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(pointsRef.current);
      
      if (intersects.length > 0 && intersects[0].object.userData.filePath) {
        setHighlightedPath(intersects[0].object.userData.filePath);
        highlightRelatedFiles(intersects[0].object.userData.filePath);
      } else {
        setHighlightedPath(null);
        resetHighlights();
      }
    };

    const handleResize = () => {
      if (containerRef.current) {
        cameraRef.current.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };
    
    containerRef.current.addEventListener('mousemove', handleMouseMove);
    containerRef.current.addEventListener('click', handleClick);
    window.addEventListener('resize', handleResize);
    
    const animate = () => {
      if (!animating) return;
      
      const delta = clockRef.current.getDelta();
      const elapsedTime = clockRef.current.getElapsedTime();
      
      pointsRef.current.forEach((point, index) => {
        if (point.userData && point.userData.animate) {
          const pulseSpeed = 0.5 + (index % 5) * 0.1;
          const pulseAmount = 0.05 + (index % 3) * 0.02;
          const originalScale = point.userData.originalScale || 1;
          
          const pulseFactor = Math.sin(elapsedTime * pulseSpeed) * pulseAmount + 1;
          point.scale.set(
            originalScale * pulseFactor, 
            originalScale * pulseFactor, 
            originalScale * pulseFactor
          );
        }
      });
      
      linesRef.current.forEach((line, index) => {
        if (line.userData && line.userData.animate) {
          const opacityPulse = Math.sin(elapsedTime * (0.3 + index * 0.01)) * 0.2 + 0.6;
          line.material.opacity = opacityPulse;
        }
      });
      
      if (groupRef.current) {
        groupRef.current.rotation.y += rotationSpeed * delta;
        groupRef.current.rotation.x += rotationSpeed * 0.3 * delta;
      }
      
      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(pointsRef.current);
      
      pointsRef.current.forEach(point => {
        if (point.userData && point.userData.originalOpacity) {
          point.material.opacity = point.userData.originalOpacity;
        }
      });
      
      if (intersects.length > 0 && intersects[0].object.userData.filePath) {
        const hoveredObject = intersects[0].object;
        hoveredObject.material.opacity = 1;
        
        setHoveredElement({
          path: simplifyPath(hoveredObject.userData.filePath),
          fullPath: hoveredObject.userData.filePath,
          imports: hoveredObject.userData.imports,
          imported_by: hoveredObject.userData.imported_by
        });
      } else {
        setHoveredElement(null);
      }
      
      controlsRef.current.update();
      rendererRef.current.render(sceneRef.current, cameraRef.current);
      
      requestAnimationFrame(animate);
    };
    
    clockRef.current.start();
    animate();
    
    return () => {
      if (rendererRef.current && rendererRef.current.domElement) {
        try {
          containerRef.current.removeChild(rendererRef.current.domElement);
        } catch (e) {
          console.error("Error removing renderer:", e);
        }
      }
      
      containerRef.current.removeEventListener('mousemove', handleMouseMove);
      containerRef.current.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
    };
  }, [projectData, visualizationMode, animating, rotationSpeed]);

  const initThreeJs = () => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(
      60,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 30;
    cameraRef.current = camera;
    
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    
    const group = new THREE.Group();
    scene.add(group);
    groupRef.current = group;
    
    const ambientLight = new THREE.AmbientLight(0x444444);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    
    const colors = [0x0088ff, 0xff2200, 0x00ff88];
    colors.forEach((color, index) => {
      const intensity = 1;
      const light = new THREE.PointLight(color, intensity, 50);
      const angle = (index / colors.length) * Math.PI * 2;
      const radius = 30;
      light.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        10
      );
      scene.add(light);
    });
    
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 1.2;
    controls.panSpeed = 0.8;
    controls.autoRotate = false;
    controlsRef.current = controls;
  };

  const createVisualization = () => {
    if (!projectData) return;
    
    const files = projectData.project?.files || {};
    const hotspots = projectData.insights?.dependency_hotspots || [];
    
    visualizeDependencies(files, hotspots);
  };

  const visualizeDependencies = (files, hotspots) => {
    const fileKeys = Object.keys(files);
    const nodeMap = {};
    
    const dependenciesGroup = new THREE.Group();
    groupRef.current.add(dependenciesGroup);
    
    fileKeys.forEach((fileKey, index) => {
      const theta = Math.acos(2 * Math.random() - 1); 
      const phi = Math.random() * Math.PI * 2;
      const radius = 15 + Math.random() * 5; 
      
      const x = radius * Math.sin(theta) * Math.cos(phi);
      const y = radius * Math.sin(theta) * Math.sin(phi);
      const z = radius * Math.cos(theta);
      
      let color;
      if (fileKey.includes('app/')) {
        color = 0xff3333; 
      } else if (fileKey.includes('components/')) {
        color = 0x33ff33; 
      } else if (fileKey.includes('lib/') || fileKey.includes('utils/')) {
        color = 0x3333ff; 
      } else if (fileKey.includes('test')) {
        color = 0xffcc00; 
      } else {
        color = 0xffffff; 
      }
      
      const importsCount = files[fileKey].imports ? files[fileKey].imports.length : 0;
      const importedByCount = files[fileKey].imported_by ? files[fileKey].imported_by.length : 0;
      const size = 0.5 + Math.min(importsCount + importedByCount, 5) * 0.2;
      
      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshPhongMaterial({ 
        color: color,
        specular: 0xffffff,
        shininess: 50,
        transparent: true,
        opacity: 0.9
      });
      
      const point = new THREE.Mesh(geometry, material);
      point.position.set(x, y, z);
      
      point.userData = {
        filePath: fileKey,
        imports: files[fileKey].imports,
        imported_by: files[fileKey].imported_by,
        originalScale: 1,
        originalColor: color,
        originalOpacity: 0.9,
        animate: true
      };
      
      dependenciesGroup.add(point);
      pointsRef.current.push(point);
      
      nodeMap[fileKey] = {
        point,
        x, y, z,
        color
      };
    });
    
    fileKeys.forEach(fileKey => {
      const sourceNode = nodeMap[fileKey];
      if (!sourceNode) return;
      
      const fileImports = files[fileKey].imports || [];
      
      fileImports.forEach(imp => {
        if (imp.type === "internal" && imp.resolved && nodeMap[imp.resolved]) {
          const targetNode = nodeMap[imp.resolved];
          
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
          ]);
          
          const sourceColor = new THREE.Color(sourceNode.color);
          const targetColor = new THREE.Color(targetNode.color);
          const mixedColor = new THREE.Color().lerpColors(sourceColor, targetColor, 0.5);
          
          const material = new THREE.LineBasicMaterial({ 
            color: mixedColor,
            transparent: true,
            opacity: 0.6,
            linewidth: 1
          });
          
          const line = new THREE.Line(geometry, material);
          line.userData = {
            source: fileKey,
            target: imp.resolved,
            originalColor: mixedColor.getHex(),
            originalOpacity: 0.6,
            animate: true
          };
          
          dependenciesGroup.add(line);
          linesRef.current.push(line);
        }
      });
    });
    
    hotspots.forEach(hotspot => {
      if (hotspot.type === "Circular Dependency") {
        const sourceNode = nodeMap[hotspot.file];
        const targetNode = nodeMap[hotspot.with];
        
        if (sourceNode && targetNode) {
          const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(sourceNode.x, sourceNode.y, sourceNode.z),
            new THREE.Vector3(targetNode.x, targetNode.y, targetNode.z)
          ]);
          
          const material = new THREE.LineBasicMaterial({ 
            color: 0xff0000,
            transparent: true,
            opacity: 0.8,
            linewidth: 2
          });
          
          const line = new THREE.Line(geometry, material);
          line.userData = {
            source: hotspot.file,
            target: hotspot.with,
            originalColor: 0xff0000,
            originalOpacity: 0.8,
            isCircular: true,
            animate: true
          };
          
          dependenciesGroup.add(line);
          linesRef.current.push(line);
        }
      }
    });
  };
  
  const highlightRelatedFiles = (filePath) => {
    resetHighlights();
    
    pointsRef.current.forEach(point => {
      if (point.material) {
        point.material.opacity = 0.2;
        point.userData.originalOpacity = 0.2;
      }
    });
    
    linesRef.current.forEach(line => {
      if (line.material) {
        line.material.opacity = 0.1;
      }
    });
    
    const fileData = projectData.project.files[filePath];
    if (!fileData) return;
    
    const mainNode = pointsRef.current.find(p => p.userData && p.userData.filePath === filePath);
    if (mainNode) {
      mainNode.material.opacity = 1;
      mainNode.userData.originalOpacity = 1;
      mainNode.scale.multiplyScalar(1.5);
    }
    
    const importedFiles = fileData.imports
      .filter(imp => imp.type === "internal" && imp.resolved)
      .map(imp => imp.resolved);
    
    importedFiles.forEach(importedPath => {
      const importNode = pointsRef.current.find(p => p.userData && p.userData.filePath === importedPath);
      if (importNode) {
        importNode.material.opacity = 0.8;
        importNode.userData.originalOpacity = 0.8;
        importNode.scale.multiplyScalar(1.2);
      }
      
      linesRef.current.forEach(line => {
        if (
          (line.userData && line.userData.source === filePath && line.userData.target === importedPath) ||
          (line.userData && line.userData.target === filePath && line.userData.source === importedPath)
        ) {
          line.material.opacity = 1;
          line.material.color.set(0x00ffff);
        }
      });
    });
    
    const importedBy = fileData.imported_by || [];
    importedBy.forEach(importingPath => {
      const importingNode = pointsRef.current.find(p => p.userData && p.userData.filePath === importingPath);
      if (importingNode) {
        importingNode.material.opacity = 0.8;
        importingNode.userData.originalOpacity = 0.8;
        importingNode.scale.multiplyScalar(1.2);
      }
      
      linesRef.current.forEach(line => {
        if (
          (line.userData && line.userData.source === importingPath && line.userData.target === filePath) ||
          (line.userData && line.userData.target === importingPath && line.userData.source === filePath)
        ) {
          line.material.opacity = 1;
          line.material.color.set(0xff00ff);
        }
      });
    });
  };
  
  const resetHighlights = () => {
    pointsRef.current.forEach(point => {
      if (point.userData && point.userData.originalScale) {
        point.scale.set(
          point.userData.originalScale,
          point.userData.originalScale,
          point.userData.originalScale
        );
      }
      
      if (point.material && point.userData && point.userData.originalColor) {
        point.material.color.set(point.userData.originalColor);
      }
      
      if (point.material) {
        point.material.opacity = point.userData ? (point.userData.originalOpacity || 0.8) : 0.8;
      }
    });
    
    linesRef.current.forEach(line => {
      if (line.material && line.userData && line.userData.originalColor) {
        line.material.color.set(line.userData.originalColor);
        line.material.opacity = line.userData.originalOpacity || 0.3;
      }
    });
  };
  
  const handleInputChange = (e) => {
    setInputValue(e.target.value);
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <div className="bg-gray-900 p-4 border-b border-blue-900">
        <h1 className="text-2xl font-bold mb-2 text-cyan-400">Project Dependency Visualizer</h1>
        
        <div className="mb-4">
          <div className="flex flex-col">
            <label className="text-sm text-gray-400 mb-1">Paste Project JSON Data:</label>
            <textarea 
              ref={textareaRef}
              className="bg-gray-800 text-white border border-gray-700 rounded p-2 h-24 mb-2"
              placeholder="Paste your project dependency JSON data here..."
              value={inputValue}
              onChange={handleInputChange}
            />
            <div className="flex justify-end">
              <button 
                className="px-4 py-2 rounded bg-gradient-to-r from-blue-600 to-cyan-500 shadow-lg shadow-blue-500/20"
                onClick={handleVisualize}
              >
                Visualize
              </button>
            </div>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <span className="w-3 h-3 inline-block bg-red-500 rounded-full mr-1"></span>
              <span className="text-xs">App Files</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 inline-block bg-green-500 rounded-full mr-1"></span>
              <span className="text-xs">Components</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 inline-block bg-blue-500 rounded-full mr-1"></span>
              <span className="text-xs">Utils/Libs</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 inline-block bg-yellow-500 rounded-full mr-1"></span>
              <span className="text-xs">Tests</span>
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 inline-block bg-red-700 rounded-full mr-1"></span>
              <span className="text-xs">Circular Dependencies</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button 
              className="text-xs px-3 py-1 rounded bg-gray-800 hover:bg-gray-700"
              onClick={() => setAnimating(!animating)}
            >
              {animating ? 'Pause' : 'Animate'}
            </button>
            
            <div className="flex items-center">
              <span className="text-xs mr-2">Rotation:</span>
              <input 
                type="range" 
                min="0" 
                max="0.01" 
                step="0.001" 
                value={rotationSpeed}
                onChange={(e) => setRotationSpeed(parseFloat(e.target.value))}
                className="w-24"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="relative flex-grow">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl text-blue-400">Loading visualization...</div>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl text-red-500">Error: {error}</div>
          </div>
        ) : !projectData ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xl text-gray-400">
              Paste your project data above and click "Visualize" to get started
            </div>
          </div>
        ) : (
          <>
            <div 
              ref={containerRef} 
              className="absolute inset-0"
            />
            
            {hoveredElement && (
              <div className="absolute top-4 right-4 bg-gray-900 bg-opacity-90 border border-blue-900 rounded p-4 max-w-xs shadow-xl">
                <h3 className="text-cyan-400 font-medium truncate">
                  {hoveredElement.path}
                </h3>
                <div className="mt-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Imports:</span>
                    <span className="text-white">{hoveredElement.imports ? hoveredElement.imports.length : 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Imported by:</span>
                    <span className="text-white">{hoveredElement.imported_by ? hoveredElement.imported_by.length : 0}</span>
                  </div>
                </div>
              </div>
            )}
            
            {highlightedPath && (
              <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-90 border border-blue-900 rounded p-4 max-w-xs shadow-xl">
                <h3 className="text-cyan-400 font-medium truncate">
                  Selected: {simplifyPath(highlightedPath)}
                </h3>
                <div className="mt-2 text-xs text-gray-400">
                  Click anywhere to deselect
                </div>
              </div>
            )}
          </>
        )}
      </div>
      
      <div className="bg-gray-900 border-t border-blue-900 p-2 text-xs text-gray-500 flex justify-between">
        <div>
          Neural Network View: Visualizing interconnected file dependencies
        </div>
        <div>
          Project Stats: {projectData?.metadata?.total_files || 0} Files • {projectData?.metadata?.total_dependencies || 0} Dependencies
        </div>
      </div>
    </div>
  );
};

export default ProjectVisualizer;