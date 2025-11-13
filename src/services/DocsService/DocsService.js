if (typeof DocsService === 'undefined') {
  // @ts-ignore - create namespace in GAS
  var DocsService = {};
}
// Ensure Internal namespace exists even if other files created a bare DocsService earlier
DocsService.Internal = DocsService.Internal || {};

DocsService.convertDocToHtml = function (docURL) {
  var doc = DocumentApp.openByUrl(docURL);
  var body = doc.getBody();
  var html = '<html><body>';

  html += this.Internal.processElement_(body);

  html += '</body></html>';
  html.replace(/></g, ">\n<");
  return html;
}

DocsService.Internal.processElement_ = function (element) {
  var html = "";
  switch (element.getType()) {
    case DocumentApp.ElementType.PARAGRAPH:
      html += "<p>";
      var numChildren = element.getNumChildren();
      for (var i = 0; i < numChildren; i++) {
        html += this.processElement_(element.getChild(i));
      }
      html += "</p>";
      break;
    case DocumentApp.ElementType.LIST_ITEM:
      html += "<li>";
      var numChildren = element.getNumChildren();
      for (var i = 0; i < numChildren; i++) {
        html += this.processElement_(element.getChild(i));
      }
      html += "</li>";
      break;
    case DocumentApp.ElementType.TABLE_CELL:
      html += "<td>";
      var numChildren = element.getNumChildren();
      for (var i = 0; i < numChildren; i++) {
        html += this.processElement_(element.getChild(i));
      }
      html += "</td>";
      break;
    case DocumentApp.ElementType.TEXT:
      html += this.processText_(element);
      break;
    case DocumentApp.ElementType.TABLE:
      html += "<table>";
      for (var i = 0; i < element.getNumRows(); i++) {
        html += "<tr>";
        for (var j = 0; j < element.getRow(i).getNumCells(); j++) {
          html += this.processElement_(element.getRow(i).getCell(j));
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
        html += this.processElement_(items[i]);
      }
      html += listType.replace("<", "</");
      break;
    case DocumentApp.ElementType.BODY_SECTION:
    case DocumentApp.ElementType.BODY:
      var numChildren = element.getNumChildren();
      for (var i = 0; i < numChildren; i++) {
        html += this.processElement_(element.getChild(i));
      }
      break;
    default:
      html += element.getText() || "";
  }
  return html;
}

DocsService.Internal.processText_ = function (element) {
  var html = "";
  var text = element.getText();

  if (!text) return "";

  var attributeIndices = element.getTextAttributeIndices();

  if (attributeIndices.length === 0) {
    return this.encodeHtmlEntities_(text); // No formatting, just return the text
  }

  var lastIndex = 0;

  for (var i = 0; i < attributeIndices.length; i++) {
    var index = attributeIndices[i];
    var segmentText = this.encodeHtmlEntities_(text.substring(lastIndex, index));

    if (segmentText) {
      var linkUrl = element.getLinkUrl(lastIndex);
      var attributes = element.getAttributes(lastIndex);
      var styledSegment = this.applyTextAttributes_(segmentText, attributes);

      if (linkUrl) {
        html += '<a href="' + linkUrl + '">' + styledSegment + '</a>';
      } else {
        html += styledSegment;
      }
    }

    lastIndex = index;
  }

  // Handle the last segment
  var lastSegmentText = text.substring(lastIndex);
  if (lastSegmentText) {
    var lastLinkUrl = element.getLinkUrl(lastIndex);
    var lastAttributes = element.getAttributes(lastIndex);
    var lastStyledSegment = this.applyTextAttributes_(lastSegmentText, lastAttributes);

    if (lastLinkUrl) {
      html += '<a href="' + lastLinkUrl + '">' + lastStyledSegment + '</a>';
    } else {
      html += lastStyledSegment;
    }
  }

  return html;
}

DocsService.Internal.applyTextAttributes_ = function (text, attributes) {
  var html = text;

  if (attributes.BOLD) {
    html = '<b>' + html + '</b>';
  }
  if (attributes.ITALIC) {
    html = '<i>' + html + '</i>';
  }
  if (attributes.UNDERLINE) {
    html = '<u>' + html + '</u>';
  }
  if (attributes.FONT_SIZE) {
    html = '<span style="font-size:' + attributes.FONT_SIZE + 'px;">' + html + '</span>';
  }
  if (attributes.FOREGROUND_COLOR) {
    html = '<span style="color:' + attributes.FOREGROUND_COLOR + ';">' + html + '</span>';
  }
  if (attributes.BACKGROUND_COLOR) {
    html = '<span style="background-color:' + attributes.BACKGROUND_COLOR + ';">' + html + '</span>';
  }

  return html;
}

DocsService.Internal.encodeHtmlEntities_ = function (text) {
  return text.replace(/[&'’"]/g, function (c) {
    switch (c) {
      case '&': return '&amp;';
      case "'": return '&#39;';
      case '’': return '&rsquo;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

