# MaleCNS Data Dictionary

Oct 27, 2026

## Overview

This dictionary explains every column in the three MaleCNS v1.0 tables used by the Connectome Fly project, plus the tables the project builds from them. MaleCNS v1.0 is the connectome of one male fruit fly's entire central nervous system (brain and nerve cord), shared by HHMI Janelia, the University of Cambridge, MRC LMB and Google Research under a CC-BY 4.0 license.

**How the data was made.** The nervous system was preserved, stained and imaged layer by layer with an electron microscope at 8 nm per pixel. AI traced every cell through the image stack; each traced 3D object is a **body**, identified by a number. Separate AI models found every synapse and predicted each body's neurotransmitter. Scientists then proofread the tracing and named the neurons.

| File | Rows | What one row is | ID column(s) |
| --- | --- | --- | --- |
| `body-annotations-male-cns-v1.0-minconf-0.5.feather` | 211,577 | One body and everything known about what it is | `bodyId` |
| `body-neurotransmitters-male-cns-v1.0.feather` | 1,835,518 | One body with output synapses, and its predicted transmitter | `body` |
| `connectome-weights-male-cns-v1.0-minconf-0.5.feather` | 151,856,684 | One connection between two bodies, with its synapse count | `body_pre`, `body_post` |

The same body number links all three files: `bodyId` = `body` = `body_pre` / `body_post`. Not every body is a neuron. Of the 211,577 annotated bodies, the 166,700 with a `superclass` are neurons; the rest are glia and fragments. The transmitter and connection tables are larger because they also include millions of small traced fragments.

**Reading the column entries.** Each entry gives the column's meaning, its data type, how much of the table it fills (from the project's exploration notebook), and example values. Where a meaning is inferred rather than documented, the entry says so.

## Annotations: identity and proofreading

These columns say which body a row is, what it is called, and how carefully it was checked.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `bodyId` | int64 | 100% | The body's unique ID number. Just a label: its size or order means nothing. Links to `body` in the transmitter table and `body_pre` / `body_post` in the connection table. | 10001, 10360 |
| `type` | text | 77.8% | The cell type. Neurons with the same shape, position and connections share a type, and usually do the same job. The most important column for choosing neurons. Placeholder names like `CB1671` mark types nobody has studied yet. | DNp01, DNa02, KCg-m, ORN_DM1 |
| `instance` | text | 76.3% | The type plus extra detail, usually the side (`_L`, `_R`) and sometimes a nickname in brackets. | DNp01(GF)_R, VS_L |
| `group` | float | 69.7% | Links mirror-image partners: the left and right copies of one neuron share a group number, which appears to be borrowed from one member's `bodyId`. | 10001.0, 10360.0 |
| `vfbId` | text | 78.8% | The neuron's ID on Virtual Fly Brain (virtualflybrain.org), a public site where you can look up its 3D shape and details. | VFB_jrmc30my |
| `status` | text | 97.4% | How the body was proofread. See the values below. | Traced, Anchor, Orphan |
| `statusLabel` | category | 99.6% | A more detailed version of `status`, distinguishing levels of tracing. | Roughly traced, Reviewed, Glia |

**Values of `status` and `statusLabel`:**

- **Traced / Reviewed**: well-checked neurons, the most trustworthy.
- **Roughly traced / Prelim Roughly traced**: mostly complete, less polished. Fine for simulation, but small branches may be missing.
- **Anchor**: a neuron with a cell body that served as a starting point for proofreading.
- **Orphan**: a fragment that could not be attached to any neuron.
- **Unimportant**: a small piece not worth proofreading.
- **Glia**: a support cell, not a neuron. Glia do not make chemical synapses and must be left out of a neural simulation.

## Annotations: classification

Four columns sort neurons into families, from broadest to narrowest: `superclass` → `class` → `subclass` → `supertype` → `type`.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `superclass` | text | 78.8% | The broadest family. Filled for exactly the 166,700 neurons, so it is the cleanest way to separate neurons from glia and fragments. | cb_intrinsic, descending_neuron |
| `class` | text | 12.5% | A narrower group, usually a brain system. | MBON, ALPN, ALLN, CX |
| `subclass` | text | 10.4% | Short codes subdividing some classes. Their exact meaning in this dataset is not documented here; check the MaleCNS paper before relying on them. | lt, xl, pm |
| `supertype` | text | 16.1% | A number grouping several closely related types. | 10006, 10015 |

**Common `class` values:** `ALPN` = antennal lobe projection neurons (carry smell to the rest of the brain); `ALLN` = antennal lobe local neurons (process smell inside the antennal lobe); `MBON` = mushroom body output neurons (outputs of the learning center); `CX` = central complex (navigation); `ol_bilateral` = optic lobe neurons linking both sides.

**Every `superclass` value** (prefixes: `ol` = optic lobe, `cb` = central brain, `vnc` = ventral nerve cord; `_tbc` = "to be confirmed"):

| Value | Neurons | What they are |
| --- | --- | --- |
| `ol_intrinsic` | 89,403 | Stay inside the optic lobes and do early visual processing. Over half of all neurons. |
| `cb_intrinsic` | 32,164 | Stay inside the central brain: learning, navigation, decisions, smell processing. |
| `vnc_intrinsic` | 13,161 | Stay inside the nerve cord and coordinate legs and wings. |
| `visual_projection` | 9,201 | Carry visual information from the optic lobes into the central brain. |
| `vnc_sensory` | 6,370 | Body senses entering the nerve cord: touch, leg position, wing load. |
| `ol_sensory` | 6,098 | Photoreceptors, the light sensors of the eyes. |
| `cb_sensory` | 4,868 | Head senses entering the brain: smell, taste, humidity, hearing. |
| `ascending_neuron` | 1,846 | Carry reports up from the nerve cord to the brain. |
| `descending_neuron` | 1,314 | Carry commands down from the brain to the nerve cord. |
| `vnc_motor` | 708 | Move muscles of the legs, wings and body. |
| `visual_centrifugal` | 563 | Carry signals from the brain back out to the optic lobes. |
| `sensory_ascending` | 537 | Sensory neurons whose fibers run from the body all the way up to the brain. |
| `cb_motor` | 107 | Move head and mouth muscles, such as the proboscis. |
| `vnc_efferent` | 94 | Leave the nerve cord to targets other than ordinary muscles. |
| `cb_endocrine` | 72 | Brain neurons that release hormones. |
| `ENS` | 50 | The enteric nervous system: nerves of the gut. |
| `vnc_tbc` | 38 | Nerve cord neurons of unconfirmed family. |
| `vnc_sensory_tbc` | 36 | Probable nerve cord sensory neurons, unconfirmed. |
| `vnc_endocrine` | 22 | Nerve cord neurons that release hormones. |
| `cb_sensory_tbc` | 14 | Probable brain sensory neurons, unconfirmed. |
| `sensory_descending` | 12 | Sensory neurons whose fibers run from the head down into the nerve cord. |
| `efferent_ascending` | 8 | Efferent neurons that also send a branch up to the brain. |
| `efferent_descending` | 4 | Efferent neurons that also send a branch down the nerve cord. |
| `cb_efferent` | 4 | Brain neurons leaving to non-muscle targets. |
| `visual_projection_tbc`, `sensory_ascending_tbc`, `descending_neuron_tbc` | 2 each | Unconfirmed members of those families. |
| *(empty)* | 44,877 bodies | Not a neuron: glia, orphans and fragments. |

## Annotations: location

These columns say where a neuron sits in the body and how it connects to the outside world.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `somaSide` | text | 71.2% | Side of the cell body (soma): left, right, or `M` for midline neurons that are not paired. | L, R, M |
| `rootSide` | text | 8.5% | Side where the neuron's main fiber enters the nervous system. Used mainly for sensory neurons, whose cell bodies sit outside the nervous system (in the antenna, for example). Use this, not `somaSide`, to tell which antenna an ORN belongs to. | L, R, unknown |
| `somaNeuromere` | text | 10.3% | Which segment of the nervous system holds the cell body. See the values below. | CG, DC, LB, T1 |
| `somaLocation` | list of 3 numbers | 67.0% | The x, y, z position of the cell body in the 3D image, in 8 nm pixel units. Each cell holds a small array, which makes this column slow to process with tools like `.unique()`. | [37124 22258 36274] |
| `tosomaLocation` | list of 3 numbers | 0.5% | Inferred: a point on the fiber leading toward the cell body, recorded when the cell body itself could not be placed. | [59041 40434 26364] |
| `assignedOlHex1`, `assignedOlHex2` | float | 11.2% | Two coordinates placing an optic lobe neuron in one of the eye's hexagonal columns. The compound eye has roughly 800 facets, and the optic lobe is organized in matching columns. Needed for feeding images into the brain. | 12.0, 26.0 |
| `entryNerve` | text | 5.6% | The nerve a sensory neuron enters through. | AN, ON, aPhN, AbN4 |
| `exitNerve` | text | 0.5% | The nerve a neuron leaves through, usually toward muscles or glands. | PhN, CvN, NCC |

**Values of `somaNeuromere`:** `CG` = cerebral ganglion (the brain); `DC` = deutocerebrum (the brain region holding the antennal lobes); `MD`, `MX`, `LB` = mandibular, maxillary and labial segments (below the brain, serving the mouthparts); `T1`, `T2`, `T3` = the three thoracic segments, serving the front, middle and hind legs; abdominal segments may also appear.

**Nerve abbreviations:** `AN` = antennal nerve; `ON` = ocellar nerve (from the three small simple eyes on top of the head); `aPhN` = anterior pharyngeal nerve (taste inside the mouth); `PhN` = pharyngeal nerve; `AbN` = abdominal nerves; `CvN` = cervical nerve (neck); `NCC` = nerve to the corpora cardiaca, a hormone-releasing gland; `MxLbN` = maxillary-labial nerve (mouthparts).

## Annotations: development

Every fly neuron is born from a stem cell called a **neuroblast**. Each neuroblast divides many times, and the neurons it produces form a **lineage**, often split into two **hemilineages** with distinct shapes and roles. These columns record a neuron's family tree.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `itoleeHl` | text | 17.8% | Hemilineage in the naming system of Ito and Lee, used mainly for brain neurons. `putative` marks an uncertain assignment; `no_lineage` means none could be assigned. | ALad1__prim, LB3, putative_primary |
| `trumanHl` | text | 9.3% | Hemilineage in the naming system of Truman and colleagues, used for nerve cord neurons. Numbers name the lineage, letters A/B the hemilineage. | 03B_put1, 00B, 12B |
| `birthtime` | text | 3.7% | Whether the neuron was born early or late during development. Early-born neurons are often larger and form the core of a circuit. | early, late |

Two naming systems exist because different research groups mapped brain and nerve cord lineages independently. Lineage is useful for finding related neurons: neurons from the same hemilineage often share a transmitter and a general role.

## Annotations: matching, repeated and sex-related

**Matching to other connectomes.** Earlier datasets mapped parts of other flies: **FlyWire** (a whole female brain, 2024), the **hemibrain** (part of a female brain) and **MANC** (a male nerve cord only). These columns connect MaleCNS neurons to their counterparts, which matters because published papers use those older names.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `flywireType` | text | 67.7% | The matching type name in FlyWire. Several names joined by commas mean one MaleCNS type matches several FlyWire types. | DNp01, VS1,VS2,...,VS8 |
| `hemibrainType` | text | 15.6% | The matching name in the hemibrain. Sometimes an older common name. | Giant Fiber, AOTU019 |
| `mancType` | text | 10.7% | The matching type in MANC. | DNp01, DNg56 |
| `mancBodyid` | float | 8.8% | The matching neuron's body ID in MANC. | 10000.0 |
| `mancGroup` | float | 6.9% | The matching left/right group in MANC. | 10012.0 |
| `synonyms` | text | 1.9% | Names used for the neuron in older papers, with the authors and year. | Sapkal 2024: BDN2 |
| `matchingNotes` | text | 1.6% | Comments on how a match differs, often a male-female difference. | extra branches in male |

**Repeated neurons across segments.** The nerve cord has three nearly identical leg segments (T1, T2, T3), so many neurons come in repeated sets, one per segment. These are called **serial homologs**.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `mancSerial` | float | 2.6% | Groups serially repeated neurons, using MANC's numbering. | 11305.0 |
| `mcnsSerial` | float | 1.9% | The same grouping in MaleCNS's own numbering. | 10041.0 |
| `serialMotif` | text | 0.4% | The pattern a repeated set forms, for example whether its members converge onto a shared target in the brain, nerve cord or both. | brain convergent, cns tiling |

**Sex differences.** This is a male fly, so these columns are especially interesting.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `dimorphism` | text | 1.1% | Whether a type differs between the sexes, from comparison with the female FlyWire brain. | male-specific, sexually dimorphic |
| `fruDsx` | text | 2.4% | Expression of **fruitless** and **doublesex**, two genes that build sex-specific circuits such as those for courtship. `high` / `low` give the level; `coexpress` means both genes. | fru_high, dsx_high, coexpress_low |
| `receptorType` | text | 0.4% | For some sensory neurons, the receptor they likely carry. `ppk23` and `ppk25` detect pheromones (chemical signals between flies); `IR52b` is linked to contact chemical sensing. | putative_ppk25, putative_IR52b |

## Neurotransmitter table

Use `consensus_nt`: it is the dataset's final recommended transmitter for each body.

**How predictions are made.** At each chemical synapse, the sending neuron has a dark T-shaped structure, the **T-bar**, where packets of neurotransmitter gather before release. Different transmitters come with subtly different-looking packets and T-bars. An AI trained on cell types with known transmitters predicts a transmitter for every T-bar, and the predictions are combined per body. Bodies without T-bars (glia, fragments that only receive) get no row, which is why 24,561 annotated bodies are missing here. The table has 1.8 million rows because it includes every fragment with at least one T-bar.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `body` | int64 | 100% | The body's ID. Same numbers as `bodyId` in the annotations table. | 10001 |
| `cell_type` | text | 9.0% | The body's type, copied in for convenience. Filled only for named neurons (about 165,000 rows), not fragments. | DNp01, VS |
| `total_nt_predictions` | int32 | 100% | How many of the body's T-bars received a prediction. More T-bars make a more trustworthy vote. | 1015, 4425 |
| `predicted_nt` | text | 100% | The winning transmitter for this one body. `unclear` means no transmitter won clearly, common for fragments with few T-bars. | acetylcholine, gaba, unclear |
| `predicted_nt_confidence` | float | 100% | How decisive that win was, from 0 to 1. 0.5 is shaky; above 0.9 is confident. | 0.50, 0.96 |
| `ground_truth` | text | 4.7% | The transmitter established by lab experiments for that cell type. Rare, but the most reliable value, and used to check the AI's accuracy. | gaba, acetylcholine |
| `celltype_total_nt_predictions` | int32 | 100% | T-bars counted after pooling every neuron of the same type. | 1991, 8721 |
| `celltype_predicted_nt` | text | 100% | The winning transmitter after pooling the whole type. More reliable than a single body, because neurons of one type almost always share a transmitter. | acetylcholine, histamine |
| `celltype_predicted_nt_confidence` | float | 9.0% | Confidence of the pooled prediction. Filled only for typed neurons. | 0.53, 0.96 |
| `consensus_nt` | text | 100% | The final recommended answer, combining the evidence above. Probably prefers lab results, then the pooled type prediction, then the single-body prediction; check the MaleCNS paper for the exact rule. | acetylcholine, glutamate |

**What the transmitters mean in a fly:**

- **acetylcholine**: the main excitatory transmitter; pushes the next neuron toward firing. About 62% of neurons.
- **GABA**: the main inhibitory transmitter; pushes the next neuron away from firing.
- **glutamate**: usually inhibitory in the fly central brain (unlike in humans), but excitatory at muscles.
- **histamine**: used mainly by photoreceptors; inhibits the next neurons, so fly vision starts with a sign flip.
- **dopamine, serotonin, octopamine**: modulators that adjust circuits over seconds to minutes, for example signaling reward or arousal, rather than simply making neurons fire.

**Limitation:** electrical synapses (gap junctions) pass current directly between cells and have no T-bars, so they appear in neither this table nor the connection table. Example: the Giant Fiber (`DNp01`) drives its jump motor neuron mainly through an electrical synapse, which is invisible here; its prediction confidence is only 0.50.

## Connection weights table

Each row is one directed connection: body A sends signals to body B through some number of synapses.

| Column | Type | Filled | Meaning | Examples |
| --- | --- | --- | --- | --- |
| `body_pre` | int64 | 100% | The **presynaptic** body: the sender, whose T-bars release transmitter. | 10352 |
| `body_post` | int64 | 100% | The **postsynaptic** body: the receiver, whose receptors sit across the gap. | 10351 |
| `weight` | int64 | 100% | The number of synapses from sender to receiver. More synapses make a stronger connection. Always positive: whether it excites or inhibits comes from the sender's transmitter, not from this table. | 2591, 3 |

**What a synapse count means.** A fly synapse is usually **one-to-many**: one T-bar faces several receiving cells at once. Each sender–receiver pair at a T-bar counts as one synapse in the weight. So a weight of 50 means the receiver sits opposite the sender's release sites 50 times.

**`minconf-0.5` in the file name.** Every detected synapse has a confidence score from 0 to 1 for how sure the AI is that it is real. This version counts only synapses with confidence of at least 0.5.

**Size and order.** The file holds 151,856,684 rows in 2,318 chunks of 65,536 rows, sorted strongest first. The strongest connection in the nervous system has 2,591 synapses, from `Li32` to `Li33`, two optic lobe neurons; `Li32` uses GABA, so it is a powerful inhibitory link. Keeping only connections where both ends are among the 166,700 neurons leaves 25,582,938 connections carrying 124,177,617 synapses.

**A known scale difference.** Male synapse counts in MaleCNS run about 1.7 times higher than in the female FlyWire connectome, probably due to differences in imaging and detection. The MaleCNS team multiplies male weights by 0.581 when comparing the two. The project's simulation uses the same factor.

## Tables built in this project

**`data/neurons.parquet`**: one row per neuron, 166,700 rows. Row *i* describes neuron *i* of every matrix below.

| Column | Source | Meaning |
| --- | --- | --- |
| `bodyId` | annotations | The MaleCNS body ID, to trace a neuron back to the dataset. |
| `type`, `instance`, `superclass`, `class`, `somaSide`, `rootSide` | annotations | As described in the annotation sections above. |
| `consensus_nt` | transmitter table | The neuron's transmitter, or `unknown` for the 178 neurons with no prediction. |
| `sign` | computed | +1 (excitatory) or -1 (inhibitory). -1 for GABA, glutamate and histamine; +1 for everything else, including modulators, `unclear` and `unknown`. Totals: 107,438 excitatory, 59,262 inhibitory. |

**`data/edges.parquet`**: the 25,582,938 connections between neurons, as positions rather than body IDs.

| Column | Meaning |
| --- | --- |
| `pre` | Sender's row number in `neurons.parquet` (0 to 166,699). |
| `post` | Receiver's row number. |
| `weight` | Synapse count, unsigned. |

**`data/W.npz`**: the raw signed connectivity matrix, 166,700 × 166,700, in scipy's sparse CSR format (308 MB). Row = sender, column = receiver, value = synapse count × the sender's sign.

**`data/W_calibrated.npz`**: `W.npz` after the calibration rules in `flybrain/calibrate.py`, which remove connections a point-neuron model cannot represent faithfully (modulator outputs, Kenyon cell to Kenyon cell, input onto sensory neurons, excitatory local-neuron and PN-to-PN connections) and cap each neuron's total excitatory input.

**`data/calibration.json`**: the record of how `W_calibrated.npz` was made: the weight scale (0.581), the excitation cap and its percentile, and the full list of changes.

**`exports/vinegar_circuit.json`**: the 625-neuron vinegar circuit for the web app: model parameters, the connection matrix in millivolts (`csr`), input ORNs (`left_orns`, `right_orns`), the vinegar PN readout, each neuron's `body_id`, `type` and `superclass`, and validation targets for the TypeScript engine.

## Notes and sources

Column meanings come from the MaleCNS project pages and from exploring the data; fill percentages and counts come from the project's exploration notebook. Entries marked inferred or uncertain (`subclass` codes, `tosomaLocation`, the exact `consensus_nt` rule) should be checked against the MaleCNS paper before relying on them.

- [MaleCNS project page](https://male-cns.janelia.org)
- [MaleCNS downloads](https://male-cns.janelia.org/download/)
- [Virtual Fly Brain](https://www.virtualflybrain.org), to look up any neuron by its `vfbId`
- Shiu et al., Nature 2024: the leaky integrate-and-fire model and parameters used for simulation
