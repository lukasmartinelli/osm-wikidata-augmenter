#!/usr/bin/env node
var transformXml = require('./xml');
var augmentTranslations = require('./translations');
var diff = require('deep-diff').diff;
var wikidata = require('./wikidata')

function logTagDifferences(elemType, osmId, originalTags, augmentedTags) {
	var differences = diff(originalTags, augmentedTags);
	if(differences) {
		differences.forEach(function(d) {
			if(d.kind === "E") {
				console.log(`Changed ${d.path}=${d.lhs} to ${d.path}=${d.rhs} for ${elemType} ${osmId}`);
			}
			if(d.kind === "N") {
				console.log(`Added ${d.path}=${d.rhs} for ${elemType} ${osmId}`);
			}
			if(d.kind === "D") {
				console.log(`Deleted ${d.path}=${d.lhs} for ${elemType} ${osmId}`);
			}
		});
	}
}

function buildTransformer(program) {
	function augmentTags(elemType, elem, cb) {
            if (!elem.tags.wikidata) {
                cb(elem);
                return;
            };
            wikidata.queryWikidata(elem.tags.wikidata, function(entity) {
                if(!entity) {
                    cb(tags);
                    return;
                }
                    var augmentedTags = elem.tags;
                    augmentedTags = augmentTranslations(entity, augmentedTags);
                    augmentedTags = wikidata.augmentElevation(entity, augmentedTags);
                    augmentedTags = wikidata.augmentPopulation(entity, augmentedTags);
                    augmentedTags = wikidata.augmentPostal(entity, augmentedTags);
                    if(program.verbose) {
                        logTagDifferences(elemType, elem.id, elem.tags, augmentedTags);
                    }
                    elem.tags = augmentedTags;
                    cb(elem);
            });
	}

	return {
		transformNode: augmentTags.bind(undefined, 'node'),
		transformWay: augmentTags.bind(undefined, 'way'),
		transformRelation: augmentTags.bind(undefined, 'relation'),
	};
}

var program = require('commander');
program
  .version('0.1')
  .option('-i, --input-file <input-file>', 'raw OpenStreetMap XML file source')
  .option('-o, --output-file <output-file>', 'augmented OpenStreetMap XML file target')
  .option('--verbose', 'log augmentations')
  .parse(process.argv);

if(program.inputFile && program.outputFile) {
	if(program.labels) {
		console.log('Augmenting OSM names with Wikidata labels');
	}
	var transformer = buildTransformer(program);
	transformXml(program.inputFile, program.outputFile, transformer);
} else {
	program.outputHelp();
}
