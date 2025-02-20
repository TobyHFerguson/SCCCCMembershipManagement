const ConfigurationManager = (function() {
    let actionSpecs, groupEmails;

    function getActionSpecs() {
        if (!actionSpecs) {
            initializeActionSpecs();
        }
        return actionSpecs;
      }
      
      function getGroupEmails() {
        if (!groupEmails) {
            groupEmails = getFiddler_('Group Email Addresses').getData();
        }
        return groupEmails
      }
      
    function initializeActionSpecs() {
        convertLinks_('Action Specs');
        // We use getDataWithFormulas_ because the Body of an ActionSpec may contain formulas with a URL.
        const actionSpecsAsArray = getDataWithFormulas_(getFiddler_('Action Specs'))
        console.log('Action Specs as Array:', actionSpecsAsArray);
        actionSpecs = Object.fromEntries(actionSpecsAsArray.map(spec => [spec.Type, spec]));
        console.log('Action Specs:', actionSpecs);
        for (const actionSpec of Object.values(actionSpecs)) {
          console.log('Action Spec:', actionSpec);
          let match = actionSpec.Body.match(/=hyperlink\("(https:\/\/docs.google.com\/document\/d\/[^"]+)"/);
          if (match) {
            console.log('Match:', match);
            let url = match[1];
            actionSpec.Body = DocsService.convertDocToHtml(url);
          } else {
            console.log('No Match: ', actionSpec.Body);
          }
        }
        
    }
    return {
        getActionSpecs,
        getGroupEmails
    }
})()