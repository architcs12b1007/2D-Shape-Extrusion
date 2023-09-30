import React, { useEffect, useRef, useState } from "react";
import * as BABYLON from "@babylonjs/core";
import * as GUI from "@babylonjs/gui";
import earcut from "earcut";

const App = () => {
  // Create a reference to the canvas element
  const canvasRef = useRef(null);

  // Define state variables for different modes
  const [drawingMode, setDrawingMode] = useState(false);
  const [extrudingMode, setExtrudingMode] = useState(false);
  const [moveMode, setMoveMode] = useState(false);
  const [vertexEditMode, setVertexEditMode] = useState(false);

  // Create a pointer drag behavior for interaction
  const pointerDragBehavior = new BABYLON.PointerDragBehavior({
    dragPlaneNormal: BABYLON.Vector3.Up(),
  });

  // Create refs to hold current values of state variables
  const drawingRef = useRef();
  drawingRef.current = drawingMode;
  const extrudingRef = useRef();
  extrudingRef.current = extrudingMode;
  const moveRef = useRef();
  moveRef.current = moveMode;
  const vertexEditRef = useRef();
  vertexEditRef.current = vertexEditMode;

  // Create refs for various objects in the scene
  let polygonShape = useRef(null);
  let extrudedShape = useRef(null);

  // Arrays to store drawing and vertex points
  let drawingPoints = [];
  let vertexPoints = [];
  let meshSphere = [];

  // Use effect to initialize the Babylon.js scene
  useEffect(() => {
    // Create a Babylon.js engine and scene
    const engine = new BABYLON.Engine(canvasRef.current, true);
    const scene = new BABYLON.Scene(engine);

    // Create and configure a camera
    const camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 2,
      5,
      BABYLON.Vector3.Zero(),
      scene
    );
    camera.position = new BABYLON.Vector3(0, 15, -10);
    camera.attachControl(canvasRef.current, true);

    // Create a ground with a material
    const groundMaterial = new BABYLON.StandardMaterial(
      "groundMaterial",
      scene
    );
    groundMaterial.diffuseColor = new BABYLON.Color3(40 / 255, 30 / 255, 0);
    const ground = BABYLON.MeshBuilder.CreateGround(
      "ground",
      { width: 10, height: 10 },
      scene
    );
    ground.position.y = 0;
    ground.material = groundMaterial;

    // Create a light source
    const light = new BABYLON.HemisphericLight(
      "light",
      new BABYLON.Vector3(0, 1, 0),
      scene
    );

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Resize event handler
    window.addEventListener("resize", () => {
      engine.resize();
    });

    // Pointer down event handler

    scene.onPointerDown = (event) => {
      // Handle drawing mode
      if (drawingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit) {
          const point = pickResult.pickedPoint.clone();

          // Create a marker sphere at the picked point
          const marker = BABYLON.MeshBuilder.CreateSphere(
            "marker",
            { diameter: 0.2 },
            scene
          );
          meshSphere.push(marker);
          marker.position = point;

          // Store the point in the drawingPoints array
          drawingPoints.push(point);
        }
      }

      // Handle ending drawing mode
      if (
        drawingRef.current &&
        event.button === 2 &&
        drawingPoints.length >= 3
      ) {
        // Create a polygon shape from the collected drawing points
        polygonShape = BABYLON.MeshBuilder.CreatePolygon(
          "polygonShape",
          { shape: drawingPoints },
          scene,
          earcut
        );
        polygonShape.position.y = 0.01;

        // Apply a material to the polygon shape
        const groundMaterial = new BABYLON.StandardMaterial(
          "groundMaterial",
          scene
        );
        groundMaterial.diffuseColor = new BABYLON.Color3(0, 0, 1);
        polygonShape.material = groundMaterial;

        // Dispose of the marker spheres used for drawing
        const len = drawingPoints.length;
        for (let i = 0; i < len; i++) {
          meshSphere[i].dispose();
        }

        // Disable drawing mode
        setDrawingMode(false);
      }

      // Handle extruding mode
      if (extrudingRef.current && event.button === 0) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (pickResult.hit && pickResult.pickedMesh === polygonShape) {
          // Extrude the polygon shape to create a 3D shape
          extrudedShape = BABYLON.MeshBuilder.ExtrudePolygon(
            "extrudedShape",
            {
              shape: drawingPoints,
              depth: 2,
              wrap: true,
              updatable: true,
            },
            scene,
            earcut
          );
          extrudedShape.position.y = 2;

          // Apply a material to the extruded shape
          const extrudeMat = new BABYLON.StandardMaterial(
            "Extruded Mesh Material",
            scene
          );
          extrudeMat.diffuseColor = new BABYLON.Color3(0, 0, 1);
          extrudeMat.backFaceCulling = false;
          extrudeMat.twoSidedLighting = true;
          extrudedShape.material = extrudeMat;

          // Dispose of the polygon shape
          polygonShape.dispose();

          // Disable extruding mode
          setExtrudingMode(false);
        }
      }

      // Handle moving extruded shape
      const pickResult = scene.pick(scene.pointerX, scene.pointerY);
      if (
        pickResult.hit &&
        pickResult.pickedMesh === extrudedShape &&
        moveRef.current
      ) {
        // Allow the user to drag the extruded shape using pointerDragBehavior
        pickResult.pickedMesh.addBehavior(pointerDragBehavior);
      } else {
        // Remove the drag behavior if not selected or moving mode is disabled
        pickResult.pickedMesh.removeBehavior(pointerDragBehavior);
      }

      // Handle vertex editing mode
      if (vertexEditRef.current) {
        const pickResult = scene.pick(scene.pointerX, scene.pointerY);
        if (
          pickResult.hit &&
          pickResult.pickedMesh === extrudedShape &&
          event.button === 0
        ) {
          // Check if a vertex on the extruded shape was clicked while in vertex editing mode

          // Initialize data structures for tracking unique vertices
          let verticesData = [];
          const sharedVertices = new Map();
          const uniqueVertices = [];
          let originalVertexData = extrudedShape.getVerticesData(
            BABYLON.VertexBuffer.PositionKind
          );

          const worldMatrix = extrudedShape.getWorldMatrix();

          // Loop through the original vertex data
          for (let i = 0; i < originalVertexData.length; i += 3) {
            const originalVertex = new BABYLON.Vector3(
              originalVertexData[i],
              originalVertexData[i + 1],
              originalVertexData[i + 2]
            );
            verticesData.push(originalVertex.asArray());
          }

          // Find shared and unique vertices
          verticesData.forEach((vertex, index) => {
            const key = vertex.join(" ");
            if (sharedVertices.has(key)) {
              sharedVertices.set(key, [...sharedVertices.get(key), index]);
            } else {
              sharedVertices.set(key, [index]);
              const transformedVertex = BABYLON.Vector3.TransformCoordinates(
                BABYLON.Vector3.FromArray(vertex),
                worldMatrix
              ).asArray();
              uniqueVertices.push({
                vertex: transformedVertex,
                key,
              });
            }
          });

          // Iterate through unique vertices for editing
          uniqueVertices.forEach(({ vertex, key }) => {
            const indices = sharedVertices.get(key);

            // Create a pointer drag behavior for each vertex
            const pointerDrag = new BABYLON.PointerDragBehavior();

            pointerDrag.onDragObservable.add((info) => {
              // Update the positions of vertices when dragged
              indices.forEach((index) => {
                verticesData[index] = BABYLON.Vector3.FromArray(
                  verticesData[index]
                )
                  .add(info.delta)
                  .asArray();
              });

              // Update the extruded shape with the modified vertex positions
              extrudedShape.updateVerticesData(
                BABYLON.VertexBuffer.PositionKind,
                verticesData.flat()
              );
            });

            // Create a sphere to represent the editable vertex
            const sphere = BABYLON.MeshBuilder.CreateSphere(
              "vertexSphere",
              { diameter: 0.3 },
              scene
            );

            // Set the sphere's position to the transformed vertex position
            sphere.position = BABYLON.Vector3.FromArray(vertex);

            // Adjust the drag delta ratio to control dragging sensitivity
            pointerDrag.dragDeltaRatio = 1;

            // Add the drag behavior to the sphere
            sphere.addBehavior(pointerDrag);

            // Store the sphere representing the vertex
            vertexPoints.push(sphere);
          });
        }
      }
    };

    // Create an advanced texture for GUI elements that covers the entire screen
    const advancedTexture = GUI.AdvancedDynamicTexture.CreateFullscreenUI(
      "UI",
      true,
      scene
    );

    // Create a container for buttons
    const buttonContainer = new GUI.StackPanel();
    buttonContainer.width = "500px";
    buttonContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    buttonContainer.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
    buttonContainer.paddingTopInPixels = "500px";
    advancedTexture.addControl(buttonContainer);

    // Create a button for drawing mode
    const drawButton = GUI.Button.CreateSimpleButton("drawButton", "Draw");
    drawButton.width = "150px";
    drawButton.height = "100px";
    drawButton.color = "white";
    drawButton.paddingTop = "30px";
    drawButton.background = "green";
    drawButton.onPointerDownObservable.add(() => {
      setDrawingMode(true);
    });
    buttonContainer.addControl(drawButton);

    // Create a button for extruding mode
    const extrudeButton = GUI.Button.CreateSimpleButton(
      "extrudeButton",
      "Extrude"
    );
    extrudeButton.width = "150px";
    extrudeButton.height = "100px";
    extrudeButton.color = "white";
    extrudeButton.background = "brown";
    extrudeButton.paddingTop = "30px";
    extrudeButton.onPointerDownObservable.add(() => setExtrudingMode(true));
    buttonContainer.addControl(extrudeButton);

    // Create a button for moving mesh mode
    const moveButton = GUI.Button.CreateSimpleButton("moveButton", "Move");
    moveButton.width = "150px";
    moveButton.height = "100px";
    moveButton.color = "white";
    moveButton.background = "blue";
    moveButton.paddingTop = "30px";
    moveButton.onPointerDownObservable.add(() => {
      if (moveRef.current) setMoveMode(false);
      else setMoveMode(true);
    });
    buttonContainer.addControl(moveButton);

    // Create a button for vertex Editing mode
    const vertexEditButton = GUI.Button.CreateSimpleButton(
      "vertexEditButton",
      "Edit Vertex"
    );
    vertexEditButton.width = "150px";
    vertexEditButton.height = "100px";
    vertexEditButton.color = "white";
    vertexEditButton.background = "orange";
    vertexEditButton.paddingTop = "30px";
    vertexEditButton.onPointerDownObservable.add(() => {
      if (vertexEditRef.current) {
        setVertexEditMode(false);
        vertexPoints.forEach((vertex) => vertex.dispose());
        vertexPoints = [];
      } else setVertexEditMode(true);
    });
    buttonContainer.addControl(vertexEditButton);

    // Cleanup function: Dispose of the scene and engine when the component unmounts
    return () => {
      scene.dispose();
      engine.dispose();
    };
  }, []);

  // Return a canvas element to be rendered in the React component
  return (
    <div>
      <canvas
        ref={canvasRef}
        style={{ width: "100vw", height: "100vh", overflow: "hidden" }}
      />
    </div>
  );
};

export default App;
