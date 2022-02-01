# Simple Entity Management Example

    //There already must exists an attribute called "name" and another one called "age"
    var nameValueId = Attribute.newVariable({
        belonging: {
            concept: "user",
            id: "4711"
        },
        attribute: "name",
        value: "Peter"
    });
    var ageValueId = Attribute.newVariable({
        belonging: {
            concept: "user",
            id: "4711"
        },
        attribute: "age",
        value: "23"
    });

    var petersAge = Attribute.getValueByID(ageValueId);

    // petersAge is set to 23 now

    Attribute.changeVariable({
        valueId: ageValueId,
        value: '24'
    });

    petersAge = Attribute.findLastValueByID(ageValueId);

    // petersAge is set to 24 now

    var pater = Attribute.findAttributeValuesByConcept({
        conceptName: 'user',
        userID: '4711'
    });

    // peter is set to:
    //   { name: 'Peter', age: '24' }

# Calculation Functions Example

       new Attribute({
           name: 'url',
           representionRule: '{{url}}',
           domain: 'global.specify.io/domains/webpage'
       });

       new Attribute({
           name: 'html',
           representionRule: '{{string}}',
           domain: 'global.specify.io/domains/webpage',
           revisioning: {
               active: true
           },
           calculation: {
               function: (webpageUrl, harvestFn) => {
                   http.get(webpageUrl, (result) => {
                       harvestFn(result.getBody());
                   })
               },
               validity: 60 * 1000,
               eagerCalculation: true
           }
       });

       new Attribute({
           name: 'link',
           representionRule: '{{url}}|{{path}}',
           domain: 'global.specify.io/domains/webpage',
       });

       new Attribute({
           name: 'links',
           collectionOf: 'link',
           revisioning: {
               active: true
           },
           calculation: {
               function: (webpageHtml, harvestFn) => {
                   harvestFn( /*calculate links from webpageHtml*/ )
               },
               eagerCalculation: true
           }
       });

       var webpageUrlVariableID = Attribute.newVariable({
           attribute: "url",
           belonging: {
               concept: "webpage",
               id: "4711"
           },
           value: "https://en.wikipedia.org/wiki/Object-relational_impedance_mismatch"
       });

       // - because the html attribute is configured with a validity of 60000 milliseconds this and
       //   with eager calculation this value will be recalculated every minute.
       // - because the html we pass the webpageUrlValueID in as a parameter and because the html
       //   attribute is configured with an eager calculation this value will be recalculated whenever the
       //   url attribute value with the passed id change.
       var webpageHtmlVariableID = Attribute.newVariable({
           attribute: "html",
           belonging: {
               concept: "webpage",
               id: "4711"
           },
           inputAttributes: [webpageUrlValueID]
       });

       var linksVariableID = Attribute.newVariables({
           attribute: "links",
           belonging: {
               concept: "webpage",
               id: "4711"
           },
           inputAttributes: [webpageHtmlValueID]
       });
