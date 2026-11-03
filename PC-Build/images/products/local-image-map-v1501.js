(function(){
'use strict';
var old=window.AZOBSS_PC_LOCAL_IMAGES||{};
var badIds=['allit-deepcool-cc310-black','allit-coolermaster-qube-540'];
var badNames=['deepcool cc310 micro atx case black','cooler master qube 540 atx case'];
if(old&&old.ready===true){
  var next=Object.assign({},old,{version:'1501',policy:'local-locked',enforceLocal:true,liveImageMutation:false});
  next.byId=Object.assign({},old.byId||{}); next.byName=Object.assign({},old.byName||{}); next.byUrl=Object.assign({},old.byUrl||{});
  // v1501 refuses the known v1500 ALL IT banner mappings until the preparer replaces them with exact product media.
  badIds.forEach(function(id){delete next.byId[id];delete next.byId['json-'+id];});
  badNames.forEach(function(name){delete next.byName[name];});
  window.AZOBSS_PC_LOCAL_IMAGES=next;return;
}
window.AZOBSS_PC_LOCAL_IMAGES={version:'1501',policy:'local-locked',ready:false,enforceLocal:true,liveImageMutation:false,expected:66,downloaded:0,byId:{},byUrl:{},byName:{}};
})();
