import { satisfiesType } from "parsing/nodeTypes";
import { getDefinition, getDependencies } from "./builtins";
import computeContext, {
  Analysis,
  ComputedContext,
  Statement,
} from "./computeContext";
import emitChunkGL from "./emitChunkGL";
import { colorToVec3, getGLType, glslFloatify } from "./outputHelpers";

function getImplicits(context: ComputedContext) {
  const implicits = [];

  for (let id in context.analysis) {
    const analysis = context.analysis[id];
    const statement = context.statements[id];
    const userData = statement.userData;
    if (
      userData.type === "expression" &&
      userData.shouldGraph &&
      analysis.evaluationState.is_inequality &&
      analysis.evaluationState.is_graphable &&
      analysis.rawTree.type !== "Error" &&
      satisfiesType(analysis.rawTree, "BaseComparator") &&
      analysis.concreteTree.type === "IRExpression"
    ) {
      implicits.push(id);
    }
  }
  return implicits;
}

function accDeps(depsAcc: string[], dep: string) {
  if (depsAcc.includes(dep)) return;
  getDependencies(dep).forEach((d) => accDeps(depsAcc, d));
  depsAcc.push(dep);
}

export default function exportAsGLesmos() {
  const context = computeContext();
  const implicitIDs = getImplicits(context);
  let functionDeps: string[] = [];
  let implicitFuncBody = "";
  let body = "";
  let i = 0;
  for (let id of implicitIDs) {
    const { funcSource, drawSource, deps } = implicitToGL(
      context.statements[id],
      context.analysis[id],
      i
    );
    i++;
    implicitFuncBody += funcSource + "\n\n";
    body += drawSource + "\n";
    deps.forEach((d) => accDeps(functionDeps, d));
  }

  return [
    functionDeps.map(getDefinition).join("\n"),
    implicitFuncBody,
    "vec4 outColor = vec4(1.0);",
    "void glesmosMain(vec2 coords) {",
    "  float x = coords.x; float y = coords.y;",
    body,
    "}",
  ].join("\n");
}

function implicitToGL(statement: Statement, analysis: Analysis, i: number) {
  // assumes statement is an implicit
  // currently just ignores line/border
  const userData = statement.userData;
  const metaData = statement.metaData;
  if (
    userData.type !== "expression" ||
    !satisfiesType(statement, "BaseComparator")
  ) {
    throw "Expected implicit";
  }
  if (analysis.concreteTree.type !== "IRExpression") {
    throw "Expected IRExpression";
  }
  const color = metaData.colorLatexValue ?? userData.color ?? "#00FF00";
  // metaData.computedFillOpacity could be a number, number[], NaN, or undefined
  let fillOpacity = metaData.computedFillOpacity ?? NaN;
  if (Array.isArray(color) || Array.isArray(fillOpacity)) {
    throw "Lists of implicits not yet implemented";
  }
  fillOpacity = isNaN(fillOpacity) ? 0.4 : fillOpacity;
  const colorStr = colorToVec3(color);
  const opacityStr = glslFloatify(fillOpacity);
  const { source, deps } = emitChunkGL(analysis.concreteTree._chunk);
  let f = `_f${i}`;
  let type = getGLType(analysis.concreteTree.valueType);
  return {
    funcSource: `${type} ${f}(float x, float y) {\n${source}\n}`,
    drawSource:
      `  if (${f}(x,y) > 0.0) {\n` +
      `    outColor.rgb = mix(outColor.rgb, ${colorStr}, ${opacityStr});\n` +
      `  }`,
    deps,
  };
}