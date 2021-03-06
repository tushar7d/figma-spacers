// This plugin will open a modal to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser enviroment (see documentation).

// This shows the HTML page in "ui.html".
figma.showUI(__html__);

const LabelStyle = {type: 'SOLID', color: {r: 0.8, g: 0, b: 1}};
const FrameStyle = {type: 'SOLID', color: {r: 0.98, g: 0.89, b: 1}};

const SpacersProperty = 'spacers';
const HideProperty = 'hide';

//names of the layers considered as spacers
const SpacerName = "spacer_";
const LabelName = 'label_';
const HLineName = 'hline_';
const VLineName = 'vline_';


const LEFT ='LEFT';
const RIGHT = 'RIGHT';
const BOTTOM = 'BOTTOM';
const TOP = 'TOP';
const REPLACE = 'REPLACE';
var positionVar = BOTTOM;

const SizeProperty = 'size';
// this state is stored in the document to know if showing or not the infos in a new spacer
const SpacerInfoStateProperty = 'spacer-info-state';


function makeSpacerNode(size : number) : FrameNode{ //, label : string){
  
  const text = figma.createText();
  text.name=LabelName;
  text.locked=true;
  figma.loadFontAsync({ family: "Roboto", style: "Regular" }).then(msg => {
    text.fontSize=size; 
    text.x=1;
    text.y=0;
    text.textAlignHorizontal = 'LEFT';
    text.textAlignVertical = 'TOP';
    text.characters=String(size);
    text.fills = [clone(LabelStyle)];
    text.letterSpacing = {unit:"PERCENT", value:-15 };
  });
  
  function styleLine(line : LineNode, size : number){
    line.strokes=[clone(LabelStyle)];
    line.resize(size,0);
    line.locked=true;
    line.x=0;
    line.y=0;
  }

  const hline = figma.createLine();
  hline.name=HLineName;
  styleLine(hline,size);
  hline.y=1;
 
  const vline = figma.createLine();
  vline.name=VLineName;
  styleLine(vline,size);
  vline.rotation=-90;

 
  const frame: FrameNode = figma.createFrame();
  frame.setPluginData(SizeProperty, String(size));
  frame.name=size+"px "+SpacerName;
  frame.resize(size,size);
  frame.fills=[clone(FrameStyle)];
  frame.layoutAlign='CENTER';
  frame.appendChild(text);
  frame.appendChild(hline);
  frame.appendChild(vline);

  let showInfo=true;
  showSpacerInfos(frame, figma.root.getPluginData(SpacerInfoStateProperty)!="0");
  return frame;
}

function showSpacerInfos(spacer:FrameNode, isShow : boolean){
  spacer.children.forEach(child => {
    if (child.name===HLineName || child.name===VLineName || child.name===LabelName) 
    child.visible=isShow;
  });
  if (isShow) spacer.fills=[clone(FrameStyle)]; else spacer.fills=[];
  //update size in case it was manually changed
  //let size = spacer.getPluginData(SizeProperty);
  //if (size) spacer.resize(spacer.width,Number(size));
}



function showAllSpacerInfos(isShow){
  figma.root.setPluginData(SpacerInfoStateProperty, isShow? "1":"0");
  var spacers = figma.root.findAll(node => node.type === "FRAME" && node.name.endsWith(SpacerName));
  (<FrameNode[]>spacers).forEach(spacer => showSpacerInfos(spacer, isShow));
}


// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = msg => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
 
  //get properties from project
  if (msg.type === 'get-properties-in-page') {    
    //console.log('get-properties-in-page called');
    //get Spacers In Page Properties
    var spacers = figma.root.getPluginData(SpacersProperty);
    var hide = figma.root.getPluginData(HideProperty);
    figma.ui.postMessage({type: "set-properties-from-page", spacers : spacers?arrayFrom(spacers):false, hide : Boolean(hide) });
  };
  
  //get properties from project
  if (msg.type === 'set-spacers-in-page') {    
    figma.root.setPluginData(SpacersProperty, msg.spacers.toString());
  };

  if (msg.type === 'show-spacer-infos') {
    showAllSpacerInfos(true);
    figma.root.setPluginData(HideProperty, "");
  };

  if (msg.type === 'hide-spacer-infos') {
    showAllSpacerInfos(false);
    figma.root.setPluginData(HideProperty, "1");
  };

  if (msg.type === 'remove-lone-child-frame') {
      // clone the properties of the frame
      let selection = figma.currentPage.selection[0];
      if (!selection) 
        return figma.notify("Please select a frame to remove inner frame child");
      if ((selection.type != "FRAME" && selection.type != "COMPONENT") || selection.children.length!=1 ) 
        return figma.notify("Please select a frame or component with only 1 frame as child");
      let parentFrame : DefaultFrameMixin = selection;    
      if (parentFrame.children[0].type != "FRAME" ) 
         return figma.notify("Please select a frame with only a frame as child");
      
      let child : DefaultFrameMixin = parentFrame.children[0];
      cloneAutolayoutProperties(child, parentFrame);
      cloneBlendProperties(child, parentFrame);
      cloneCornerProperties(child, parentFrame);
      cloneGeometryProperties(child, parentFrame);
      child.children.forEach(element => {
        parentFrame.appendChild(element);
      });
      child.remove();
  };


  if (msg.type === 'place-spacer') {
    positionVar= msg.position;
  };

  if (msg.type === 'add-spacer'){
    if (figma.currentPage.selection.length!=0){
      let spacer:FrameNode = makeSpacerNode(msg.size);
      let selection = figma.currentPage.selection[0];

      // add as first child if selection is an empty autolayout
      if (selection.type === "FRAME" && selection.children.length===0  ){
       
        //if not autolyout the frame is set autolayer according to the spacer direction
        if (selection.layoutMode==="NONE") {
          console.log("set autolayout mode to empty frame");
          if (positionVar === BOTTOM || positionVar===TOP )
            selection.layoutMode="VERTICAL";
          else selection.layoutMode="HORIZONTAL";
          selection.counterAxisSizingMode="FIXED";
        }

        selection.insertChild(0,spacer);
      }

      else{
        let positionInFrame = selection.parent.children.indexOf(selection);
        if (positionVar===BOTTOM){
          let parentFrame = selection.parent;
          //position at bottom if not a autolayout
          if (parentFrame.type != "FRAME" || parentFrame.layoutMode==="NONE"){
            //console.log("positionning : "+ selection.x + " "+ selection.y); 
            parentFrame.insertChild(positionInFrame+1,spacer);
            spacer.x = selection.x;
            spacer.y = selection.y+selection.height;
          } else{
            //create a new vertical autolayout if parent is horizontal
            if (parentFrame.layoutMode==="HORIZONTAL"){
              let newFrame =  figma.createFrame();
              newFrame.layoutMode = "VERTICAL";
              newFrame.counterAxisSizingMode="AUTO";
              parentFrame.insertChild(positionInFrame+1,newFrame);
              newFrame.insertChild(0,spacer);
            } else {
              parentFrame.insertChild(positionInFrame+1,spacer);
            }
          } 
        }

        if (positionVar===TOP){
          let parentFrame = selection.parent;
          //position at top if not a autolayout
          if (parentFrame.type != "FRAME" || parentFrame.layoutMode==="NONE"){
            //console.log("positionning : "+ selection.x + " "+ selection.y); 
            parentFrame.insertChild(positionInFrame,spacer);
            spacer.x = selection.x;
            spacer.y = selection.y-selection.height-spacer.height;
          } else{
            //create a new vertical autolayout if parent is horizontal
            if (parentFrame.layoutMode==="HORIZONTAL"){
              let newFrame =  figma.createFrame();
              newFrame.layoutMode = "VERTICAL";
              newFrame.counterAxisSizingMode="AUTO";
              parentFrame.insertChild(positionInFrame,newFrame);
              newFrame.insertChild(0,spacer);
            } else {
              parentFrame.insertChild(positionInFrame,spacer);
            }
          } 
        }

        if (positionVar===RIGHT){
          let parentFrame = selection.parent;
          //position at bottom if not a autolayout
          if (parentFrame.type != "FRAME" || parentFrame.layoutMode==="NONE"){
            //console.log("positionning : "+ selection.x + " "+ selection.y); 
            parentFrame.insertChild(positionInFrame+1,spacer);
            spacer.x = selection.x+selection.height;
            spacer.y = selection.y;
          } else{
            //create a new vertical autolayout if parent is horizontal
            if (parentFrame.layoutMode==="VERTICAL"){
              let newFrame =  figma.createFrame();
              newFrame.layoutMode = "HORIZONTAL";
              newFrame.counterAxisSizingMode="AUTO";
              parentFrame.insertChild(positionInFrame+1,newFrame);
              newFrame.insertChild(0,spacer);
            } else {
              parentFrame.insertChild(positionInFrame+1,spacer);
            }
          } 
        }

        if (positionVar===LEFT){
          let parentFrame = selection.parent;
          //position at top if not a autolayout
          if (parentFrame.type != "FRAME" || parentFrame.layoutMode==="NONE"){
            //console.log("positionning : "+ selection.x + " "+ selection.y); 
            parentFrame.insertChild(positionInFrame,spacer);
            spacer.x = selection.x-selection.width-spacer.width;
            spacer.y = selection.y;
          } else{
            //create a new vertical autolayout if parent is horizontal
            if (parentFrame.layoutMode==="VERTICAL"){
              let newFrame =  figma.createFrame();
              newFrame.layoutMode = "HORIZONTAL";
              newFrame.counterAxisSizingMode="AUTO";
              parentFrame.insertChild(positionInFrame,newFrame);
              newFrame.insertChild(0,spacer);
            } else {
              parentFrame.insertChild(positionInFrame,spacer);
            }
          } 
        }
        

        if (positionVar===REPLACE){
          let parentFrame = selection.parent;
          //position at bottom if not a autolayout
          if (parentFrame.type != "FRAME" || parentFrame.layoutMode==="NONE"){
            //console.log("positionning : "+ selection.x + " "+ selection.y); 
            parentFrame.insertChild(positionInFrame+1,spacer);
            spacer.x = selection.x;
            spacer.y = selection.y;
          } else{
            //create a new vertical autolayout if parent is horizontal
            if (parentFrame.layoutMode==="VERTICAL"){
              let newFrame =  figma.createFrame();
              newFrame.layoutMode = "HORIZONTAL";
              newFrame.counterAxisSizingMode="AUTO";
              parentFrame.insertChild(positionInFrame+1,newFrame);
              newFrame.insertChild(0,spacer);
            } else {
              parentFrame.insertChild(positionInFrame+1,spacer);
            }
          } 
          selection.remove();
        }


        //trick to improve undo
        if (positionVar!=REPLACE)
          figma.currentPage.selection=[figma.currentPage.selection[0]];
        //console.log(figma.currentPage.selection[0]);
        figma.currentPage.selection=[spacer];
        
        //TODO make spacer not expanded in layer panel
      }
    } else  figma.notify("Please select an element to add a spacer after");
  }
};




//util
function arrayFrom(str : string){
  return str.split(',').map(Number);
}


function clone(val) {
  const type = typeof val
  if (val === null) {
    return null
  } else if (type === 'undefined' || type === 'number' ||
             type === 'string' || type === 'boolean') {
    return val
  } else if (type === 'object') {
    if (val instanceof Array) {
      return val.map(x => clone(x))
    } else if (val instanceof Uint8Array) {
      return new Uint8Array(val)
    } else {
      let o = {}
      for (const key in val) {
        o[key] = clone(val[key])
      }
      return o
    }
  }
  throw 'unknown'
};

function cloneAutolayoutProperties(source: DefaultFrameMixin , destination: DefaultFrameMixin){
    destination.layoutMode=source.layoutMode;
    destination.counterAxisSizingMode=source.counterAxisSizingMode;
    destination.horizontalPadding = source.horizontalPadding;
    destination.verticalPadding = source.verticalPadding;
    destination.itemSpacing = source.itemSpacing;
}

function cloneGeometryProperties(source: DefaultFrameMixin , destination: DefaultFrameMixin){
  destination.fills=clone(source.fills);
  destination.strokes=clone(source.strokes);
  destination.strokeWeight=source.strokeWeight;
  destination.strokeAlign = source.strokeAlign;
  destination.strokeCap = source.strokeCap;
  destination.strokeJoin = source.strokeJoin;
  destination.dashPattern = clone(source.dashPattern);
  destination.fillStyleId = source.fillStyleId;
  destination.strokeStyleId= source.strokeStyleId;
}

function cloneCornerProperties(source: DefaultFrameMixin , destination: DefaultFrameMixin){
  destination.cornerRadius=source.cornerRadius;
  destination.cornerSmoothing=source.cornerSmoothing;
}

function cloneBlendProperties(source: DefaultFrameMixin , destination: DefaultFrameMixin){
  destination.opacity=source.opacity;
  destination.blendMode=source.blendMode;
  destination.isMask=source.isMask;
  destination.effects=clone(source.effects);
  destination.effectStyleId = source.effectStyleId;
}