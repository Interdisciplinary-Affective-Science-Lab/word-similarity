var uploadedConfig = false;

$('#configUpload').change(function(evt){
    $('#config-name').text(this.files[0].name);
    processCSV(evt, onConfigReceive);
    uploadedConfig = true;
});

$('#instructionUpload').change(function(e){
    $('#instruction-name').text(this.files[0].name);
    processCSV(e, onInstructionReceive);
});

var participantId;

$('#startButton').click(function(e){
    startInstructions();
    participantId = $('#participantId').val();

    if(!uploadedConfig){
        $.ajax({
            url: "csv/gridwords.csv",
            type: 'get',
            success: function(csvData){
                data = $.csv.toObjects(csvData);
                onConfigReceive(data);
            }
        });
    }
});

$('#nextButton').click(function(e){
    var container = $('#instructionsContainer');
    var active = container.find('.activeInstruction');
    active.removeClass('activeInstruction');
    if(active.next().length>0){
        active.next().addClass('activeInstruction');
    } else {
        startAssociation();
    }
});

/**
* Handle receiving the CSV data. 
*
* @param data the CSV data, as a javascript object.
*
*/
function onConfigReceive(data) {
    if (verifyConfig(data)) {
        // Config is valid, start the word association
        shuffleLocations(data);
        instantiateKonva(data);
    } else {
        alert('No data to import!');
    }
}


/**
* Handle receiving the instuction data. 
*
* @param data the CSV data, as a javascript object.
*
*/
function onInstructionReceive(data) {
    if (verifyConfig(data)) {
        setupInstructions(data);
    } else {
        alert('No data to import!');
    }
}

/**
* Method that checks that the browser supports the HTML5 File API
*
* @return Whether or not the browser supports File API
*/
function browserSupportFileUpload() {
    var isCompatible = false;
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        isCompatible = true;
    }
    return isCompatible;
}

/**
* Method that reads and processes the selected file
*
* @param evt the upload Event from addEventListener
* @param callback a function(object) to be called once CSV is loaded.
*
* @return the processed data as an object
*/
function processCSV(evt, callback) {
    if (!browserSupportFileUpload()) {
        alert('The File APIs are not fully supported in this browser!');
    } else {
        var data = null;
        var file = evt.target.files[0];
        var reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function(event) {
            var csvData = event.target.result;
            var data = $.csv.toObjects(csvData);
            // Send the data back to the callback
            callback(data);
        };
        reader.onerror = function() {
            alert('Unable to read ' + file.fileName);
        };
    }
}

/**
* Check if the configuration data is valid.
*
* @param data the data object after parsing. Should be array or object.
*
* @return whether or not it is valid.
*/
function verifyConfig(data){
    return data && data.length > 0;
}

// Hide the config screen (csv upload etc.)
// And show the instructions
function startInstructions(){
    $("#configScreen").hide();
    $("#instructionScreen").show();
}

// Hide the instructions
// And show the konva canvas
function startAssociation(){
    $("#instructionScreen").hide();
    $("#associationScreen").show();
}

// Hide the association screen, show the done screen
function showDoneScreen(){
    $("#associationScreen").hide();
    $("#doneScreen").show();
}

/**
* shuffle the xy coordinates among the words
*
* @param words Array of {WORD,X,Y} objects
*
* @return Array with (X,Y) coordinates shuffled amongst the words
*/
function shuffleLocations(words){
    for (var i = words.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tempx = words[i].X;
        var tempy = words[i].Y;
        words[i].X = words[j].X;
        words[i].Y = words[j].Y;
        words[j].X = tempx;
        words[j].Y = tempy;
    }

}


/**
* Set up the instructions screen. Putting in the instruction texts.
*
* @param instructions the text objects
*/
function setupInstructions(instructions){
    var container = $('#instructionsContainer');
    container.empty();
    $(instructions).each(function(idx, text){
        var s = $('<p>'+text.TEXT+'</p>');
        container.append(s);
    });
    container.children().first().addClass("activeInstruction");
}

/**
* Sets up the Konva stage and adds in the Text objects
*
* @param words is an array of {WORD,X,Y} objects to be displayed.
*/
function instantiateKonva(words){
    // first we need to create a stage
    var stage = new Konva.Stage({
        container: 'container',   // id of container <div>
        width: 500,
        height: 500
    });


    // Resize the stage with the webpage.
    function resizeStage() {
        var container = $(window);

        var containerWidth = container.width();
        var containerHeight = container.height();

        stage.width(containerWidth);
        stage.height(containerHeight);
        stage.draw();
    }

    resizeStage();
    // adapt the stage on any window resize
    $(window).resize(resizeStage);

    
    // Add white background so that black text will show up.
    var backLayer = new Konva.Layer()
    var backg = new Konva.Rect({
        width: stage.width(),
        height: stage.height(),
        x: 0,
        y: 0,
        fill: 'white'
    })
    backLayer.add(backg);
    stage.add(backLayer);


    // then create layer for texts
    var layer = new Konva.Layer();

    var dragGroup = new Konva.Group({
        draggable: true
    });

    // Keep track of Text objects for data collection
    var texts = [];
    // Add the konva Text objects using words array
    konvaTexts = $.map(words, function(word) {
        // create our text
        var text = new Konva.Text({
            x: word.X/100*stage.width(),
            y: word.Y/100*stage.height(),
            text: word.WORD,
            fontSize: 16,
            draggable: true
        });
        texts.push(text);
        text.transformsEnabled("position");
        text.on('click', function() {
            dragGroup.add(text);
            text.x(text.x()-dragGroup.x());
            text.y(text.y()-dragGroup.y());
            text.fill('green');
            text.draggable(false);
            dragGroup.draw()
            layer.draw();
        });
        text.on('ungroup', function() {
            text.fill('black');
            text.draggable(true);
            text.x(text.x()+dragGroup.x());
            text.y(text.y()+dragGroup.y());
        });
        return text;
    });
    
    // We also use the backlayer to detect clicks that don't go on any shapes
    // If click, clear out the drag group.
    backg.on('click', ungroup);
    function ungroup() {
        var children = dragGroup.getChildren();
        $.each(children, function(idx, node){
            node.fire('ungroup');
        });
        // Remove all children from drag group/ add them to layer.
        while(dragGroup.hasChildren()){
            layer.add(dragGroup.getChildren()[0])
        }
        dragGroup.x(0);
        dragGroup.y(0);
        layer.draw();
    }

    layer.add(dragGroup);

    $.each(konvaTexts,function(idx,textObject) {
        // add the texts to the layer
        layer.add(textObject);
    });

    // add the layer to the stage
    stage.add(layer);


    // Listen to the Finish button
    $("#doneButton").click(function(evt){
        ungroup();

        showDoneScreen();

        pairwiseCSV = calculatePairwise(texts);
        // let them download the data.
        var scap = $("#screencap");
        scap.attr("href",stage.toDataURL());
        scap.attr("download",participantId+"_screencap.png");
        var pairs = $("#pairwise");
        pairs.attr("href","data:text/plain;charset=utf-8,"+encodeURIComponent(pairwiseCSV));
        pairs.attr("download",participantId+"_pairwise.csv");
    });
}

/**
* Gets the center X of a konva object.
*
* @param node a Konva Node.
*
* @return the absolute center X of the node.
*/
function centerX(node){
    return node.x()+node.width()/2;
}

/**
* Gets the center Y of a konva object.
*
* @param node a Konva Node.
*
* @return the absolute center Y of the node.
*/
function centerY(node){
    return node.y()+node.height()/2;
}


/**
* The absolute pythagorean distance between the centers of nodes.
*
* @param n1 Konva node
* @param n2 second Konva node
*
* @return the absolute pythagorean distance.
*/
function dist(n1,n2){
    return Math.sqrt(
        ((centerX(n1)-centerX(n2))*(centerX(n1)-centerX(n2)))
        +((centerY(n1)-centerY(n2))*(centerY(n1)-centerY(n2))));
}

/**
* Calculate the pairwise distance between all texts.
*
* @param texts an array of Konva Text objects
*
* @return the pairwise distances and words for all pairs, as a CSV string.
*/
function calculatePairwise(texts) {
    var data = "WORD1, WORD2, DIST";
    for(i = 0; i < texts.length-1; i++) {
      for (k = i+1; k < texts.length; k++) {
          var obj1 = texts[i];
          var obj2 = texts[k];
          data += '\n' + obj1.text()
              + ',' + obj2.text()
              + ',' + dist(obj1,obj2);
      }
    }
    return data;
}
