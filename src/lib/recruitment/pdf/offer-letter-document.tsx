import React from "react";
import { readFileSync } from "fs";
import { join } from "path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { OfferLetterTemplateData } from "@/lib/recruitment/pdf/offer-letter-data";
import { formatIndianNumeral } from "@/lib/recruitment/pdf/number-to-words";

/**
 * Full-bleed letterhead (logo, gradient header/footer bars, decorative
 * pattern) extracted from the company-supplied source PDF — baked-in pixels,
 * not recreated with CSS gradients, so the design matches exactly. Read once
 * at module load; @react-pdf/renderer accepts a raw Buffer as an Image src.
 */
const LETTERHEAD_BACKGROUND = readFileSync(
  join(process.cwd(), "public", "recruitment", "offer-letter-bg.png")
);

const styles = StyleSheet.create({
  page: {
    fontSize: 9.5,
    lineHeight: 1.3,
    color: "#1f2937",
    // paddingTop only sets a start position (safe at 84, 4.3pt below the
    // logo's 79.7pt bottom) — paddingBottom instead has to absorb cumulative
    // line-height drift from ~15 stacked clauses, so 84 (4.4pt over the
    // 79.6pt footer-band threshold) measurably overlapped the footer in
    // testing. 92 is the smallest verified-safe value.
    paddingTop: 84,
    paddingBottom: 92,
    paddingHorizontal: 42,
    fontFamily: "Helvetica",
  },
  letterheadBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  heading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    marginBottom: 2,
  },
  subheading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    marginBottom: 10,
  },
  paragraph: {
    marginBottom: 22,
    textAlign: "justify",
  },
  // Single Text per clause (number as a nested bold span) rather than a
  // flexDirection:'row' View — simpler layout, avoids relying on per-row
  // wrap={false} height math the auto-pagination gets subtly wrong under
  // justified text. The real cause of the earlier footer-overlap bug was
  // paddingBottom being calibrated from too few sample columns: the actual
  // solid footer band reaches 84pt from the bottom within the text column's
  // right edge, not the ~79.6pt measured from a handful of columns earlier.
  clauseNumber: {
    fontFamily: "Helvetica-Bold",
  },
  clauseText: {
    textAlign: "justify",
    marginBottom: 2,
  },
  signatureBlock: {
    marginTop: 28,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  annexureTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 18,
    border: 1,
    borderColor: "#1f2937",
    paddingVertical: 6,
  },
  table: {
    borderWidth: 1,
    borderColor: "#1f2937",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
  },
  tableRowLast: {
    flexDirection: "row",
  },
  tableCellLabel: {
    width: "40%",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
  },
  tableCellValue: {
    width: "30%",
    padding: 6,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#1f2937",
  },
  tableCellValueLast: {
    width: "30%",
    padding: 6,
    textAlign: "center",
  },
  tableHeaderCell: {
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  grossRow: {
    fontFamily: "Helvetica-Bold",
    backgroundColor: "#f1f5f9",
  },
  noteList: {
    marginTop: 14,
  },
  noteItem: {
    marginBottom: 4,
  },
  signatureLine: {
    width: 220,
    borderBottomWidth: 1,
    borderBottomColor: "#1f2937",
    marginTop: 24,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 8.5,
    color: "#4b5563",
  },
});

function Letterhead() {
  return (
    <Image
      src={{ data: LETTERHEAD_BACKGROUND, format: "png" }}
      style={styles.letterheadBackground}
      fixed
    />
  );
}

function SignatureBlock({ label }: { label: string }) {
  return (
    <View wrap={false}>
      <View style={styles.signatureLine} />
      <Text style={styles.bold}>{label}</Text>
      <Text style={styles.signatureLabel}>Date: _______________</Text>
    </View>
  );
}

/**
 * Reproduces the ZEBL India offer-letter template (wording verbatim from the
 * company-supplied source document) with candidate-specific fields
 * substituted. The clause text itself is intentionally fixed/deterministic —
 * only the tokens interpolated below vary per offer.
 */
export function OfferLetterDocument({ data }: { data: OfferLetterTemplateData }) {
  const { salary } = data;

  return (
    <Document
      title={`ZEBL Offer Letter - ${data.candidateName}`}
      author="ZEBL India Private Limited"
    >
      <Page size="A4" style={styles.page} wrap>
        <Letterhead />

        <Text style={{ textAlign: "right", marginBottom: 28 }}>To: {data.candidateName}</Text>

        <Text style={styles.heading}>LETTER OF EMPLOYMENT</Text>
        <Text style={[styles.subheading, { marginTop: 2 }]}>
          DATE OF JOINING: {data.joiningDateFormatted}
        </Text>

        <Text style={styles.paragraph} wrap={false}>
          With reference to your application and the subsequent interview you had with us, the
          management is pleased to appoint you as &ldquo;{data.designation}&rdquo; at our branch
          office at &ldquo;{data.branch}&rdquo; on the following terms and conditions.
        </Text>

        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>1. </Text>This appointment shall be effective from the date of your joining, which shall not be
            later than &ldquo;one week&rdquo;.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>2. </Text>You will be paid {data.ctcAmountWords} per month (As per Annexure enclosed) inclusive
            of all allowances.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>3. </Text>You should be responsible for such duties and functions as detailed by the
            management or by any other person nominated by the management on its behalf to
            allocate or assign the suitable work to you from time to time.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>4. </Text>The terms set out in this letter are not comprehensive. In all matters related to
            service conditions, conduct and discipline, your services will be governed by the
            company standing orders or service rules, and any other rules as may be framed by
            the company from time to time.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>5. </Text>You are liable to be transferred from one Branch/Office/Section/Division/Job to
            another either in existence or which may come into existence in future anywhere in
            India; you shall also be liable to be deputed to any of the group organizations,
            either temporarily or permanently. You will not be entitled to any additional
            remuneration on account of such transfer or deputation.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>6. </Text>You will retire from the services of the company on reaching the age of
            superannuation which shall be 58 years unless you are otherwise disqualified due to
            continued ill health, physical or mental disability and the like in which case you
            shall be relieved even earlier compulsorily. The date of birth furnished in your SSC
            / Matriculation certificate and recorded in the service record shall be final and
            binding upon you for all purposes of service with the company.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>7. </Text>It should be understood and agreed that all trademarks/copyrights/patents/intellectual
            property rights developed in the course of your employment in the Company shall be
            sole property of the company.
        </Text>

        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>8. </Text>During the period of employment with the Company or thereafter, you will not divulge
            to any other person, orally or in writing or in any manner whatsoever, directly or
            indirectly, any information, knowledge or skill, relating to the affairs of the
            Company or its allied/associated/subsidiary Company, which you may have acquired by
            reason of your employment with the Company.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>9. </Text>You shall not work for any other organization except by the express written
            permission of the management, while you are in the service of this Company. If you
            indulge in any one or all these activities, your services are liable to be
            terminated without any notice or any reason thereof.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>10. </Text>You should adhere to the Code of Conduct/Code of Ethics as specified by the
            management from time to time.
        </Text>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Letterhead />

        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>11. </Text>You should devote your whole-time attention to the Company&rsquo;s business only and
            you are strictly prohibited during the continuance of your employment with the
            Company, which includes out of working hours also, from engaging yourself in any
            trade, business, occupation or employment, directly or indirectly, wholly or partly
            and whether paid or unpaid or honorary in any other organization. If you indulge in
            any or all of these activities, your services are liable to be terminated without
            any notice or accessing any reason thereof.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>12. </Text>SEPARATION: You agree to provide the company with two months of advance written
            notice of termination of your employment. Company reserves the right to terminate
            your employment with immediate effect if your performance is found to be
            unsatisfactory, not meeting expectations, or not up to the required standards.
            During notice period, no pending leaves, sick leaves, or casual leaves etc. will be
            considered to reduce the period of the service on notice period.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>13. </Text>For breach of the terms of employment on your part, the Company may terminate your
            employment with the Company without any notice or accessing any reason thereof.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>14. </Text>It shall be your duty to inform your employer immediately if you are affected with
            any illness or disease of communicable nature or if you are a carrier of any such
            diseases and submit yourself to such medical examination as you may be required by
            management. Failure to submit such medical examination renders you liable for
            termination of service immediately without any notice or accessing any reason
            thereof.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>15. </Text>You should be responsible for safekeeping and return in good condition and order of
            all the Company&rsquo;s property, which may be in your use, custody and charge at the
            time of leaving the Company.
        </Text>

        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>16. </Text>Any notice, order, charge sheet, communication or intimation sent through the post to
            the address furnished by you in your application/service record shall be deemed to
            have been served on you and received for all purposes of service of such
            notice/communication etc. Any change in your postal address shall be intimated to the
            Office immediately. In the same way, if any communication sent to you through your
            e-mail id is to be delivered to you until and unless we receive the message of
            webserver as &ldquo;Subject-Mail failure domain&rdquo;.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>17. </Text>If the above terms and conditions are acceptable to you, please report for duty on{" "}
            {data.joiningDateFormatted} at 10:00 AM, along with a duplicate copy of this letter
            of employment duly signed by you as a token of your acceptance for the offer made by
            us, failing which the offer of appointment stands automatically cancelled on the
            expiry of the date mentioned above.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>18. </Text>In respect of this clause, a registered letter sent to you along with a copy of the
            same under certificate of posting shall be deemed to be sufficient that the Company
            have served the contents thereof on you.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>19. </Text>Employee Agreement: The employee should sign a separate legal contract in accordance
            with the terms outlined or as mutually agreed upon by both parties.
        </Text>
        <Text style={styles.clauseText} wrap={false}>
          <Text style={styles.clauseNumber}>20. </Text>LEAVE / VACATION: You would be covered under the Indian Labor Policy. You will get 12
            days of casual leaves and 6 days of medical leaves per year upon fully accruing a
            vacation year.
        </Text>

        <View style={styles.signatureBlock}>
          <Text style={styles.bold}>For ZEBL India Private Limited</Text>
          <SignatureBlock label="Authorized Signatory" />
        </View>
      </Page>

      <Page size="A4" style={styles.page} wrap>
        <Letterhead />

        <View wrap={false}>
          <Text style={styles.annexureTitle}>ANNEXURE</Text>

          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellLabel, styles.tableHeaderCell]}>NAME</Text>
              <Text style={{ width: "60%", padding: 6 }}>{data.candidateName}</Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellLabel, styles.tableHeaderCell]}>DESIGNATION</Text>
              <Text style={{ width: "60%", padding: 6, textAlign: "center" }}>
                {data.designation}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={[styles.tableCellLabel, styles.tableHeaderCell]}>Component Name</Text>
              <Text style={[styles.tableCellValue, styles.tableHeaderCell]}>Per Month (Rs.)</Text>
              <Text style={[styles.tableCellValueLast, styles.tableHeaderCell]}>
                Per Annum (Rs.)
              </Text>
            </View>
            {salary.rows.map((row, idx) => (
              <View
                key={row.label}
                style={idx === salary.rows.length - 1 ? styles.tableRowLast : styles.tableRow}
              >
                <Text style={styles.tableCellLabel}>{row.label}</Text>
                <Text style={styles.tableCellValue}>{formatIndianNumeral(row.monthly)}</Text>
                <Text style={styles.tableCellValueLast}>{formatIndianNumeral(row.annual)}</Text>
              </View>
            ))}
            <View style={[styles.tableRowLast, styles.grossRow]}>
              <Text style={styles.tableCellLabel}>Total CTC</Text>
              <Text style={styles.tableCellValue}>
                {formatIndianNumeral(salary.grossMonthly)}
              </Text>
              <Text style={styles.tableCellValueLast}>
                {formatIndianNumeral(salary.grossAnnual)}
              </Text>
            </View>
          </View>

          <View style={styles.noteList}>
            <Text style={styles.noteItem}>• TDS and PF are deductible if applied.</Text>
            <Text style={styles.noteItem}>
              • Shift timings can be variable up to the management decision.
            </Text>
            <Text style={styles.noteItem}>
              • Your probation period will be {data.probationMonthsText} starting from joining.
            </Text>
          </View>
        </View>

        <View wrap={false} style={{ marginTop: 20 }}>
          <Text style={styles.bold}>Acceptance:</Text>
          <Text style={{ marginTop: 6 }}>
            I accept the terms and conditions set above and abide by them.
          </Text>
          <SignatureBlock label="Candidate Acceptance" />
        </View>
      </Page>
    </Document>
  );
}
