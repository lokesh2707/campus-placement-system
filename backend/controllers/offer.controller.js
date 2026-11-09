const mongoose = require("mongoose");
const crypto = require("crypto");
const Offer = require("../models/Offer");
const Application = require("../models/Application");
const AdminAuditLog = require("../models/AdminAuditLog");
const InterviewRound = require("../models/InterviewRound");
const Company = require("../models/Company");
const Institute = require("../models/Institute");
const { verifyApplicationAccess, resolveApplicationOfferFromOffer } = require("./application.controller");
const { resumePendingOfferResolutionForApplication } = require("../utils/offerRecovery");
const { normalizeRole, ROLES } = require("../constants/roles");
const publishBusinessEvent = require("../services/publishBusinessEvent");

const audit = (action, req, offer) => AdminAuditLog.create({ action, performedBy: req.user._id, targetUser: offer.student, targetCompany: offer.company, targetInstitute: offer.institute, details: { offerId: offer._id, applicationId: offer.application, status: offer.status, joiningStatus: offer.joiningStatus } });
const access = (user, record, student = false) => verifyApplicationAccess(user, { student: record.student, company: record.company, institute: record.institute }, { allowStudent: student });
const canManage = (req, offer) => { const result=access(req.user,offer); return normalizeRole(req.user.role)===ROLES.SUPER_ADMIN || (normalizeRole(req.user.role)===ROLES.RECRUITER && result.authorized); };
const idOf = (value) => value && typeof value === "object" && value._id ? value._id : value;
const safeOffer = (offer) => {
  if (!offer) return offer;
  const value = typeof offer.toObject === "function" ? offer.toObject({ depopulate: false }) : offer;
  const fields = [
    "_id", "application", "job", "student", "company", "institute", "status", "designation", "compensation",
    "issueDate", "expiryDate", "expectedJoiningDate", "actualJoiningDate", "issuedBy", "acceptedAt", "declinedAt",
    "declineReason", "revokedAt", "revocationReason", "expiredAt", "joiningStatus", "joiningReason",
    "joiningUpdatedBy", "joiningUpdatedAt", "createdAt", "updatedAt",
  ];
  const result = Object.fromEntries(fields.filter((key) => value[key] !== undefined).map((key) => [key, value[key]]));
  const referenceFields = { student: ["name"], company: ["name"], institute: ["name"], job: ["title"], application: ["status"] };
  for (const [key, nestedFields] of Object.entries(referenceFields)) {
    const reference = value[key];
    if (reference && typeof reference === "object" && reference._id) {
      result[key] = { _id: reference._id, ...Object.fromEntries(nestedFields.filter((field) => reference[field] !== undefined).map((field) => [field, reference[field]])) };
    }
  }
  return result;
};
const recordResolutionFailure = async (offer, category) => {
  try {
    await Offer.updateOne(
      {_id:offer._id,resolutionState:"PENDING",resolutionOperationId:offer.resolutionOperationId},
      {$inc:{resolutionAttempts:1},$set:{resolutionErrorCategory:category}}
    );
  } catch (_) {
    // Keep the original workflow error; a failed diagnostic update is recoverable too.
  }
};
const OFFER_CREATION_LEASE_MS = 5 * 60 * 1000;
const releaseOfferCreationClaim = (applicationId, claimId) => Application.updateOne(
  { _id:applicationId, status:"Selected", "offerCreationClaim.claimId":claimId },
  { $unset:{offerCreationClaim:1} }
);
const runResolution = async (req, offer, resolutionStatus, reason) => {
  const role = normalizeRole(req.user?.role);
  const studentDecline = role === ROLES.STUDENT && resolutionStatus === "Offer Declined";
  if (role === ROLES.STUDENT && !studentDecline) throw Object.assign(new Error("Students may only decline their own issued Offer."), { statusCode:403 });
  const app = await Application.findById(offer.application).populate("job").populate("studentProfile").populate("student");
  if (!app) throw Object.assign(new Error("Application not found"), { statusCode:404 });
  const auth=verifyApplicationAccess(req.user,app,{allowStudent:studentDecline}); if(!auth.authorized) throw Object.assign(new Error(auth.message),{statusCode:403});
  if (studentDecline) {
    const sameRef = (left, right) => String(idOf(left) ?? "") === String(idOf(right) ?? "");
    const referencesMatch = offer.status === "ISSUED"
      && sameRef(offer.application, app._id)
      && sameRef(offer.student, req.user._id)
      && sameRef(app.student, req.user._id)
      && sameRef(offer.job, app.job)
      && sameRef(offer.company, app.company)
      && sameRef(offer.institute, app.institute)
      && sameRef(app.job?.company, app.company)
      && sameRef(app.studentProfile?.user, req.user._id)
      && (!app.student?.institute || !app.institute || sameRef(app.student.institute, app.institute))
      && (!app.studentProfile?.institute || !app.institute || sameRef(app.studentProfile.institute, app.institute));
    if (!referencesMatch) throw Object.assign(new Error("Offer ownership or application references could not be verified."),{statusCode:409});
  }
  if(offer.resolutionStatus && offer.resolutionStatus!==resolutionStatus) throw Object.assign(new Error("A conflicting offer resolution is already recorded."),{statusCode:409});
  if(app.status===resolutionStatus && app.offerResolution?.durableState==="COMPLETED") { await finalizeOfferResolution(offer,app); return {alreadyResolved:true}; }
  if(app.status!=="Selected" && app.status!==resolutionStatus) throw Object.assign(new Error("Offer resolution requires a selected application."),{statusCode:409});
  const operationId=`offer_${offer._id}_${resolutionStatus.replace(/\W/g,"")}`;
  // Claim the resolution with a compare-and-set. A competing decline/revoke
  // cannot overwrite the operation selected by the first request.
  const eligibleStatuses=resolutionStatus==="Offer Declined"?["ISSUED"]:["ISSUED","ACCEPTED"];
  const claimFilter={_id:offer._id,status:{$in:eligibleStatuses},$or:[{resolutionState:null},{resolutionState:{$exists:false}},{resolutionState:"PENDING",resolutionStatus}]};
  if(resolutionStatus==="Offer Revoked") claimFilter.$and=[{$or:[{status:"ISSUED"},{status:"ACCEPTED",joiningStatus:"PENDING"}]}];
  let claimed=await Offer.findOneAndUpdate(
    claimFilter,
    {$set:{resolutionStatus,resolutionReason:reason,resolutionState:"PENDING",resolutionOperationId:operationId,resolutionErrorCategory:""}},
    {new:true,returnDocument:"after"}
  );
  if(!claimed){
    const current=await Offer.findById(offer._id);
    if(!current || current.resolutionStatus!==resolutionStatus || current.resolutionState!=="PENDING") throw Object.assign(new Error("A conflicting or terminal offer resolution is already recorded."),{statusCode:409});
    claimed=current;
  }
  offer=claimed;
  let result;
  try {
    await resolveApplicationOfferFromOffer({params:{id:String(app._id)},body:{resolutionStatus,reason,offerOperationId:operationId},user:req.user}, {status(code){this.code=code;return this;},json(body){result=body;return this;}}, (err)=>{throw err;});
  } catch (error) {
    await recordResolutionFailure(offer,"APPLICATION_RESOLUTION_PENDING");
    throw error;
  }
  if(!result?.success) {await recordResolutionFailure(offer,"APPLICATION_RESOLUTION_PENDING");throw Object.assign(new Error(result?.message||"Application resolution failed"),{statusCode:result?.alreadyResolved?409:400});}
  let fresh=await Application.findById(app._id);
  if(fresh?.status===resolutionStatus&&fresh.offerResolution?.durableState==="PENDING"){
    try{await resumePendingOfferResolutionForApplication(app._id);fresh=await Application.findById(app._id);}catch(_){/* leave the durable operation pending for startup/reconciliation recovery */}
  }
  if(!fresh||fresh.status!==resolutionStatus||fresh.offerResolution?.durableState!=="COMPLETED"){await recordResolutionFailure(offer,"APPLICATION_RESOLUTION_PENDING");throw Object.assign(new Error("Application resolution has not completed."),{statusCode:409});}
  try{await finalizeOfferResolution(offer,fresh);}catch(error){await recordResolutionFailure(offer,"FINALIZATION_FAILED");throw error;}
  return result;
};
const finalizeOfferResolution=async(offer,app)=>{
  if(offer.resolutionStatus!==app.status || offer.resolutionStatus!=="Offer Declined"&&offer.resolutionStatus!=="Offer Revoked") throw Object.assign(new Error("Offer and application resolution states conflict."),{statusCode:409});
  if(app.offerResolution?.durableState!=="COMPLETED") throw Object.assign(new Error("Application resolution is incomplete."),{statusCode:409});
  const isDecline=offer.resolutionStatus==="Offer Declined";
  const terminal=isDecline?"DECLINED":"REVOKED";
  const now=new Date();
  const finalized=await Offer.findOneAndUpdate(
    {_id:offer._id,resolutionState:"PENDING",resolutionStatus:offer.resolutionStatus,resolutionOperationId:offer.resolutionOperationId},
    {$set:{status:terminal,resolutionState:"COMPLETED",resolutionErrorCategory:"",...(isDecline?{declinedAt:offer.declinedAt||now,declineReason:offer.resolutionReason||""}:{revokedAt:now,revocationReason:offer.resolutionReason||""})}},
    {new:true,returnDocument:"after"}
  );
  if(!finalized){
    const current=await Offer.findById(offer._id);
    if(current?.resolutionState==="COMPLETED"&&current.status===terminal&&current.resolutionOperationId===offer.resolutionOperationId)return current;
    throw Object.assign(new Error("Offer resolution changed before finalization."),{statusCode:409});
  }
  return finalized;
};
const reconcilePendingOfferResolutions=async()=>{const pending=await Offer.find({resolutionState:"PENDING"}).limit(200);const results=[];for(const offer of pending){try{const app=await Application.findById(offer.application);if(!app||app.status!==offer.resolutionStatus||app.offerResolution?.durableState!=="COMPLETED"){results.push({offerId:String(offer._id),status:"PENDING",category:"APPLICATION_RESOLUTION_PENDING"});continue;}await finalizeOfferResolution(offer,app);results.push({offerId:String(offer._id),status:"COMPLETED"});}catch(_){await recordResolutionFailure(offer,"FINALIZATION_FAILED");results.push({offerId:String(offer._id),status:"FAILED",category:"FINALIZATION_FAILED"});}}return {scanned:pending.length,results};};
const createOffer=async(req,res,next)=>{
  let claimId=null;let applicationId=null;
  try{
    const a=await Application.findById(req.params.applicationId).populate("job").populate("studentProfile","institute").populate("student","institute");
    if(!a)return res.status(404).json({success:false,message:"Application not found"});
    const x=verifyApplicationAccess(req.user,a);if(!x.authorized)return res.status(403).json({success:false,message:x.message});
    if(normalizeRole(req.user.role)!==ROLES.RECRUITER&&normalizeRole(req.user.role)!==ROLES.SUPER_ADMIN)return res.status(403).json({success:false,message:"Not authorized"});
    if(a.status!=="Selected")return res.status(400).json({success:false,message:"Offers require a selected application."});
    const {designation,compensation={},expiryDate,expectedJoiningDate}=req.body;
    if(typeof designation!=="string"||!designation.trim())return res.status(400).json({success:false,message:"Designation is required."});
    applicationId=a._id;
    if(await Offer.findOne({application:applicationId}))return res.status(409).json({success:false,message:"An offer already exists for this application."});
    claimId=crypto.randomUUID();const now=new Date();const leaseExpiresAt=new Date(now.getTime()+OFFER_CREATION_LEASE_MS);
    const claim=await Application.findOneAndUpdate(
      {_id:applicationId,status:"Selected",$and:[
        {$or:[{"offerCreationClaim.claimId":null},{offerCreationClaim:{$exists:false}},{"offerCreationClaim.state":"CREATING","offerCreationClaim.expiresAt":{$lte:now}}]},
        {$or:[{"offerResolution.durableState":null},{"offerResolution.durableState":{$exists:false}}]},
      ]},
      {$set:{offerCreationClaim:{claimId,claimedAt:now,expiresAt:leaseExpiresAt,state:"CREATING",offerId:null}}},
      {new:true,returnDocument:"after"}
    );
    if(!claim)return res.status(409).json({success:false,message:"Application is being resolved or an offer is already being created."});
    const stillOwned=await Application.findOne({_id:applicationId,status:"Selected","offerCreationClaim.claimId":claimId,"offerCreationClaim.state":"CREATING","offerCreationClaim.expiresAt":{$gt:new Date()}});
    if(!stillOwned){await releaseOfferCreationClaim(applicationId,claimId);claimId=null;return res.status(409).json({success:false,message:"Offer creation claim expired before the offer could be created."});}
    if(await Offer.findOne({application:applicationId})){await releaseOfferCreationClaim(applicationId,claimId);claimId=null;return res.status(409).json({success:false,message:"An offer already exists for this application."});}
    const o=await Offer.create({application:a._id,job:a.job,student:a.student,company:a.company,institute:a.institute,designation:designation.trim(),compensation,expiryDate:expiryDate||null,expectedJoiningDate:expectedJoiningDate||null,creationClaimId:claimId});
    const completedClaim=await Application.findOneAndUpdate(
      {_id:applicationId,status:"Selected","offerCreationClaim.claimId":claimId,"offerCreationClaim.state":"CREATING","offerCreationClaim.expiresAt":{$gt:new Date()}},
      {$set:{offerCreationClaim:{claimId,claimedAt:now,expiresAt:null,state:"COMPLETED",offerId:o._id}}},
      {new:true,returnDocument:"after"}
    );
    if(!completedClaim){
      await Offer.deleteOne({_id:o._id,status:"DRAFT",creationClaimId:claimId});
      await releaseOfferCreationClaim(applicationId,claimId);claimId=null;
      return res.status(409).json({success:false,message:"Application changed while the offer was being created. No offer was retained."});
    }
    const completedClaimId=claimId;claimId=null;
    await Offer.updateOne({_id:o._id,creationClaimId:completedClaimId},{$unset:{creationClaimId:1}});
    await audit("offer_draft_created",req,o);res.status(201).json({success:true,offer:safeOffer(o)});
  }catch(e){
    if(claimId&&applicationId)try{await releaseOfferCreationClaim(applicationId,claimId)}catch(_){/* claim expires for recovery */}
    if(e.code===11000)return res.status(409).json({success:false,message:"An offer already exists for this application."});
    next(e);
  }
};
const listOffers=async(req,res,next)=>{
  try{
    const role=normalizeRole(req.user.role);
    const scope={};
    if(role===ROLES.RECRUITER){if(!req.user.company)return res.status(403).json({success:false,message:"Company assignment required"});scope.company=req.user.company;}
    else if(role===ROLES.PLACEMENT_OFFICER){if(!req.user.institute)return res.status(403).json({success:false,message:"Institute assignment required"});scope.institute=req.user.institute;}
    else if(role!==ROLES.SUPER_ADMIN)return res.status(403).json({success:false,message:"Not authorized"});
    const filter={...scope};
    const validId=(value)=>mongoose.Types.ObjectId.isValid(value);
    const idFilter=(key,value)=>{if(value&&!validId(value))throw Object.assign(new Error(`Invalid ${key} filter.`),{statusCode:400});if(value)filter[key]=new mongoose.Types.ObjectId(value);};
    // Tenant scopes are established above and can never be replaced by query parameters.
    if(role===ROLES.SUPER_ADMIN){idFilter("company",req.query.company);idFilter("institute",req.query.institute);}
    if(req.query.applicationId)idFilter("application",req.query.applicationId);
    const validStatuses=["DRAFT","ISSUED","ACCEPTED","DECLINED","REVOKED","EXPIRED"];
    const validJoining=["PENDING","JOINED","NOT_JOINED"];
    if(req.query.status){if(!validStatuses.includes(req.query.status))return res.status(400).json({success:false,message:"Invalid offer status filter."});filter.status=req.query.status;}
    if(req.query.joiningStatus){if(!validJoining.includes(req.query.joiningStatus))return res.status(400).json({success:false,message:"Invalid joining status filter."});filter.joiningStatus=req.query.joiningStatus;}
    const page=req.query.page===undefined?1:Number(req.query.page);
    const requestedLimit=req.query.limit===undefined?25:Number(req.query.limit);
    if(!Number.isInteger(page)||!Number.isInteger(requestedLimit)||page<1||requestedLimit<1)return res.status(400).json({success:false,message:"Page and limit must be positive integers."});
    const limit=Math.min(requestedLimit,100);
    const [offers,total]=await Promise.all([
      Offer.find(filter).sort({updatedAt:-1,_id:-1}).skip((page-1)*limit).limit(limit)
        .populate("student","name")
        .populate("company","name")
        .populate("institute","name")
        .populate("job","title")
        .populate("application","_id status"),
      Offer.countDocuments(filter),
    ]);
    const response={success:true,offers:offers.map(safeOffer),pagination:{page,limit,total,pages:Math.ceil(total/limit)}};
    if(role===ROLES.SUPER_ADMIN){
      const [companyIds,instituteIds]=await Promise.all([Offer.distinct("company",scope),Offer.distinct("institute",scope)]);
      const [companies,institutes]=await Promise.all([
        Company.find({_id:{$in:companyIds}}).select("name").sort({name:1}),
        Institute.find({_id:{$in:instituteIds}}).select("name").sort({name:1}),
      ]);
      response.filterOptions={companies,institutes};
    }
    res.json(response);
  }catch(e){if(e.statusCode)return res.status(e.statusCode).json({success:false,message:e.message});next(e);}
};
const getOffer=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId).populate("student","name").populate("company","name").populate("institute","name").populate("job","title").populate("application","_id status");if(!o)return res.status(404).json({success:false,message:"Offer not found"});const role=normalizeRole(req.user.role);if(role===ROLES.STUDENT?String(idOf(o.student))!==String(req.user._id):role===ROLES.RECRUITER?String(idOf(o.company))!==String(idOf(req.user.company)):role===ROLES.PLACEMENT_OFFICER?String(idOf(o.institute))!==String(idOf(req.user.institute)):role!==ROLES.SUPER_ADMIN)return res.status(404).json({success:false,message:"Offer not found"});res.json({success:true,offer:safeOffer(o)});}catch(e){next(e)}};
const updateDraft=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId);if(!o)return res.status(404).json({success:false,message:"Offer not found"});if(!canManage(req,o))return res.status(403).json({success:false,message:"Not authorized"});if(o.status!=="DRAFT")return res.status(400).json({success:false,message:"Only draft offers can be edited."});const changes={};for(const k of ["designation","compensation","expiryDate","expectedJoiningDate"])if(req.body[k]!==undefined)changes[k]=req.body[k];const updated=await Offer.findOneAndUpdate({_id:o._id,status:"DRAFT",creationClaimId:null},{$set:changes},{new:true,returnDocument:"after"});if(!updated)return res.status(409).json({success:false,message:"Offer draft changed or is still being created."});await audit("offer_draft_updated",req,updated);res.json({success:true,offer:safeOffer(updated)});}catch(e){next(e)}};
const issueOffer=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId);if(!o)return res.status(404).json({success:false,message:"Offer not found"});if(!canManage(req,o))return res.status(403).json({success:false,message:"Not authorized"});if(o.status!=="DRAFT")return res.status(400).json({success:false,message:"Only draft offers can be issued."});if(o.expiryDate&&o.expiryDate<=new Date())return res.status(400).json({success:false,message:"Offer expiry must be in the future."});const now=new Date();const updated=await Offer.findOneAndUpdate({_id:o._id,status:"DRAFT",creationClaimId:null},{$set:{status:"ISSUED",issueDate:now,issuedBy:req.user._id}},{new:true,returnDocument:"after"});if(!updated)return res.status(409).json({success:false,message:"Offer changed or is still being created."});await audit("offer_issued",req,updated);await publishBusinessEvent({eventType:"OFFER_ISSUED",aggregateType:"Offer",aggregateId:updated._id,actor:req.user._id,institute:updated.institute,company:updated.company,idempotencyKey:`offer:${updated._id}:issued:${updated.issueDate.getTime()}`});res.json({success:true,offer:safeOffer(updated)});}catch(e){next(e)}};
const myOffers=async(req,res,next)=>{try{const found=await Offer.find({student:req.user._id}).sort({updatedAt:-1}).populate("company","name").populate("institute","name").populate("job","title").populate("application","_id status");const offers=[];for(const offer of found){const current=await expireOnRead(offer,req);offers.push(safeOffer(current));}res.json({success:true,offers});}catch(e){next(e)}};
const expireOnRead=async(offer,req)=>{if(offer.status!=="ISSUED"||!offer.expiryDate||offer.expiryDate>new Date())return offer;const now=new Date();const expired=await Offer.findOneAndUpdate({_id:offer._id,status:"ISSUED",expiryDate:{$lte:now},$and:[{$or:[{resolutionState:null},{resolutionState:{$exists:false}}]},{$or:[{resolutionOperationId:null},{resolutionOperationId:{$exists:false}}]}]},{$set:{status:"EXPIRED",expiredAt:now}},{new:true,returnDocument:"after"});if(expired){await audit("offer_expired",req,expired);await publishBusinessEvent({eventType:"OFFER_EXPIRED",aggregateType:"Offer",aggregateId:expired._id,actor:null,institute:expired.institute,company:expired.company,idempotencyKey:`offer:${expired._id}:expired:${expired.expiredAt.getTime()}`});return expired;}return Offer.findById(offer._id).populate("company","name").populate("institute","name").populate("job","title").populate("application","_id status");};
const respond=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId);if(!o)return res.status(404).json({success:false,message:"Offer not found"});if(String(idOf(o.student))!==String(req.user._id))return res.status(404).json({success:false,message:"Offer not found"});if(o.status!=="ISSUED")return res.status(400).json({success:false,message:"Offer is not available for response."});if(o.expiryDate&&o.expiryDate<=new Date()){const current=await expireOnRead(o,req);if(current?.status==="EXPIRED")return res.status(400).json({success:false,message:"Offer has expired."});return res.status(409).json({success:false,message:"Offer changed before it could be expired.",offer:safeOffer(current)});}if(req.body.action==="ACCEPT"){const a=await Application.findById(o.application);if(!a||a.status!=="Selected")return res.status(409).json({success:false,message:"Application is no longer eligible for acceptance."});const now=new Date();const accepted=await Offer.findOneAndUpdate({_id:o._id,status:"ISSUED",$or:[{resolutionState:null},{resolutionState:{$exists:false}}],$and:[{$or:[{expiryDate:null},{expiryDate:{$gt:now}}]}]},{$set:{status:"ACCEPTED",acceptedAt:now}},{new:true,returnDocument:"after"});if(!accepted)return res.status(409).json({success:false,message:"Offer changed before it could be accepted."});await audit("offer_accepted",req,accepted);await publishBusinessEvent({eventType:"OFFER_ACCEPTED",aggregateType:"Offer",aggregateId:accepted._id,actor:req.user._id,institute:accepted.institute,company:accepted.company,idempotencyKey:`offer:${accepted._id}:accepted:${accepted.acceptedAt.getTime()}`});return res.json({success:true,offer:safeOffer(accepted)});}if(req.body.action==="DECLINE"){const reason=String(req.body.reason||"");const resolution=await runResolution(req,o,"Offer Declined",reason||"Student declined offer");const updatedOffer=await Offer.findById(o._id);if(!resolution?.alreadyResolved){await audit("offer_declined",req,updatedOffer||o);await publishBusinessEvent({eventType:"OFFER_DECLINED",aggregateType:"Offer",aggregateId:o._id,actor:req.user._id,institute:o.institute,company:o.company,idempotencyKey:`offer:${o._id}:declined:${updatedOffer?.resolutionOperationId||updatedOffer?.updatedAt?.getTime()}`});}return res.json({success:true,offer:safeOffer(updatedOffer)});}return res.status(400).json({success:false,message:"Invalid offer action."});}catch(e){if(e.statusCode)return res.status(e.statusCode).json({success:false,message:e.message});next(e)}};
const revokeOffer=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId);if(!o)return res.status(404).json({success:false,message:"Offer not found"});if(!canManage(req,o))return res.status(403).json({success:false,message:"Not authorized"});if(!["ISSUED","ACCEPTED"].includes(o.status))return res.status(400).json({success:false,message:"This offer cannot be revoked."});if(o.status==="ACCEPTED"&&o.joiningStatus!=="PENDING")return res.status(409).json({success:false,message:"An offer with a recorded joining outcome cannot be revoked."});if(typeof req.body.reason!=="string"||req.body.reason.trim().length<5)return res.status(400).json({success:false,message:"A revocation reason of at least five characters is required."});await runResolution(req,o,"Offer Revoked",req.body.reason.trim());const updated=await Offer.findById(o._id);await audit("offer_revoked",req,updated||o);await publishBusinessEvent({eventType:"OFFER_REVOKED",aggregateType:"Offer",aggregateId:o._id,actor:req.user._id,institute:o.institute,company:o.company,idempotencyKey:`offer:${o._id}:revoked:${updated?.resolutionOperationId||updated?.updatedAt?.getTime()}`});res.json({success:true,offer:safeOffer(updated||o)});}catch(e){if(e.statusCode)return res.status(e.statusCode).json({success:false,message:e.message});next(e)}};
const updateJoining=async(req,res,next)=>{try{const o=await Offer.findById(req.params.offerId);if(!o)return res.status(404).json({success:false,message:"Offer not found"});if(!canManage(req,o))return res.status(403).json({success:false,message:"Not authorized"});if(o.resolutionState==="PENDING")return res.status(409).json({success:false,message:"Offer resolution is pending; joining cannot be updated."});if(o.status!=="ACCEPTED"||o.joiningStatus!=="PENDING")return res.status(400).json({success:false,message:"Joining can only be recorded once for accepted offers."});if(!["JOINED","NOT_JOINED"].includes(req.body.joiningStatus))return res.status(400).json({success:false,message:"Invalid joining status."});if(req.body.joiningStatus==="JOINED"&&(!req.body.actualJoiningDate||Number.isNaN(Date.parse(req.body.actualJoiningDate))))return res.status(400).json({success:false,message:"A valid actual joining date is required."});if(req.body.joiningStatus==="NOT_JOINED"&&String(req.body.reason||"").trim().length<5)return res.status(400).json({success:false,message:"A not-joined reason of at least five characters is required."});const filter={_id:o._id,status:"ACCEPTED",joiningStatus:"PENDING",$or:[{resolutionState:null},{resolutionState:{$exists:false}}]};if(normalizeRole(req.user.role)===ROLES.RECRUITER)filter.company=req.user.company;const updated=await Offer.findOneAndUpdate(filter,{$set:{joiningStatus:req.body.joiningStatus,actualJoiningDate:req.body.actualJoiningDate||null,joiningReason:String(req.body.reason||""),joiningUpdatedBy:req.user._id,joiningUpdatedAt:new Date()}},{new:true,returnDocument:"after"});if(!updated)return res.status(409).json({success:false,message:"Offer changed or a resolution was claimed before joining could be recorded."});await audit("offer_joining_updated",req,updated);await publishBusinessEvent({eventType:"JOINING_STATUS_UPDATED",aggregateType:"Offer",aggregateId:updated._id,actor:req.user._id,institute:updated.institute,company:updated.company,idempotencyKey:`offer:${updated._id}:joining:${(updated.joiningUpdatedAt||updated.updatedAt||new Date()).getTime()}`});res.json({success:true,offer:safeOffer(updated)});}catch(e){next(e)}};
module.exports={createOffer,listOffers,getOffer,updateDraft,issueOffer,myOffers,respond,revokeOffer,updateJoining,reconcilePendingOfferResolutions,runResolution,finalizeOfferResolution,safeOffer,OFFER_CREATION_LEASE_MS};
