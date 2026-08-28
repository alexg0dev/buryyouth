(function () {
  function showThanks() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("status") !== "success") return;
    const el = document.getElementById("donate-thanks");
    if (el) el.hidden = false;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function renderDonations() {
    const donationsList = document.getElementById("donations-list");
    if (!donationsList || !window.BYC) return;

    const donationsEmpty = document.getElementById("donations-empty");
    const donationsTable = document.getElementById("donations-table");
    const donations = await BYC.getDonations();

    if (!donations.length) {
      if (donationsEmpty) donationsEmpty.hidden = false;
      if (donationsTable) donationsTable.hidden = true;
      return;
    }

    donationsList.innerHTML = donations
      .map(function (d) {
        return (
          "<tr><td>" +
          esc(d.name) +
          (d.note ? '<span class="donate-note-cell">' + esc(d.note) + "</span>" : "") +
          "</td><td>" +
          esc(d.amount) +
          "</td></tr>"
        );
      })
      .join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    showThanks();
    window.BYC_READY.then(renderDonations);
  });
})();
