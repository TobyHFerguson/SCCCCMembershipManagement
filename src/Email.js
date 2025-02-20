function convertDocToHtml_(docId) {
    var doc = DocumentApp.openById(docId);
    var body = doc.getBody();
    var html = '<html><body>';
  
    html += processElement_(body);
  
    html += '</body></html>';
    return html;
  }
  
  function processElement_(element) {
    var html = "";
    switch (element.getType()) {
      case DocumentApp.ElementType.PARAGRAPH:
      case DocumentApp.ElementType.LIST_ITEM:
      case DocumentApp.ElementType.TABLE_CELL:
        html += "<" + element.getType().toString().toLowerCase() + ">";
        var numChildren = element.getNumChildren();
        for (var i = 0; i < numChildren; i++) {
          html += processElement_(element.getChild(i));
        }
        html += "</" + element.getType().toString().toLowerCase() + ">";
        break;
      case DocumentApp.ElementType.TEXT:
        html += processText_(element);
        break;
      case DocumentApp.ElementType.TABLE:
        html += "<table>";
        for (var i = 0; i < element.getNumRows(); i++) {
          html += "<tr>";
          for (var j = 0; j < element.getRow(i).getNumCells(); j++) {
            html += processElement_(element.getRow(i).getCell(j));
          }
          html += "</tr>";
        }
        html += "</table>";
        break;
      case DocumentApp.ElementType.LIST:
        var listType = element.getType() === DocumentApp.ListType.NUMBERED ? "<ol>" : "<ul>";
        html += listType;
        var items = element.getItems();
        for (var i = 0; i < items.length; i++) {
          html += processElement_(items[i]);
        }
        html += listType.replace("<", "</");
        break;
      case DocumentApp.ElementType.BODY_SECTION:
      case DocumentApp.ElementType.BODY:
        var numChildren = element.getNumChildren();
        for (var i = 0; i < numChildren; i++) {
          html += processElement_(element.getChild(i));
        }
        break;
      default:
        html += element.getText() || "";
    }
    return html;
  }
  
  function processText_(element) {
    var html = "";
    var text = element.getText();
  
    if (!text) return "";
  
    var attributeIndices = element.getTextAttributeIndices();
  
    if (attributeIndices.length === 0) {
      return text; // No formatting, just return the text
    }
  
    var lastIndex = 0;
  
    for (var i = 0; i < attributeIndices.length; i++) {
      var index = attributeIndices[i];
      var segmentText = text.substring(lastIndex, index);
  
      if (segmentText) {
        var linkUrl = element.getLinkUrl(lastIndex);
  
        if (linkUrl) {
          html += '<a href="' + linkUrl + '">' + segmentText + '</a>';
        } else {
          html += segmentText; // No span tag
        }
      }
  
      lastIndex = index;
    }
  
    // Handle the last segment
    var lastSegmentText = text.substring(lastIndex);
    if (lastSegmentText) {
        var lastLinkUrl = element.getLinkUrl(lastIndex);
  
        if (lastLinkUrl) {
          html += '<a href="' + lastLinkUrl + '">' + lastSegmentText + '</a>';
        } else {
          html += lastSegmentText; // No span tag
        }
    }
  
    return html;
  }
  
  function testConvert() {
    var docId = '1Pi-7YpzC4WDofRYwkPiMtUjFFLkspUtszhaN9kKzwI4';
    var html = convertDocToHtml_(docId);
    Logger.log(html);
  }